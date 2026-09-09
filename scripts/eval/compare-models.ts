/**
 * Tagging eval harness (originally Step 4 model comparison; the model is now
 * fixed to Solar Pro 4, so this is the prompt/설정 A/B tool).
 *
 *   npm run eval:models -- <log file> [--chunks 10] [--seed 42]
 *
 * Runs the production path — JSON mode (`generateObject`) + one retry — on
 * sampled chunks and reports the metrics that decide prompt versions. Writes
 * a markdown report + raw JSON under .parsed/eval/ (gitignored — contains
 * log quotes, so treat it like the log itself).
 *
 * Metrics: first-try / after-retry validity, findings per stage,
 * verified-quote rate (quote occurs verbatim in the chunk — our
 * "출처 기반 정확성" measure), latency, tokens, cost per chunk and session.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { parseSession } from "../../src/lib/parser";
import { chunkSession, type Chunk } from "../../src/lib/pipeline/chunk";
import {
  estimateCostUsd,
  getModel,
  isConfigured,
  PROVIDERS,
  type ProviderConfig,
} from "../../src/lib/pipeline/llm";
import {
  STAGES,
  TAGGING_SYSTEM,
  taggingOutputSchema,
  taggingUserPrompt,
  type TaggingOutput,
} from "../../src/lib/prompts/tagging";

interface ChunkRun {
  chunkId: string;
  ok: boolean;
  /** true when the first attempt already validated (no retry needed). */
  firstTry: boolean;
  parseError?: string;
  findings: TaggingOutput["findings"];
  verifiedQuotes: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

/** Deterministic sample so both providers and reruns see identical chunks. */
function sample<T>(items: T[], n: number, seed: number): T[] {
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

/** Production path: JSON mode via generateObject, then one retry on failure. */
async function runChunk(p: ProviderConfig, chunk: Chunk): Promise<ChunkRun> {
  const t0 = Date.now();
  const base: Omit<ChunkRun, "ok" | "firstTry"> = {
    chunkId: chunk.id,
    findings: [],
    verifiedQuotes: 0,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  let parseError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generateObject({
        model: getModel(p),
        schema: taggingOutputSchema,
        system: TAGGING_SYSTEM,
        prompt: taggingUserPrompt(chunk.text),
        maxOutputTokens: 2000,
      });
      base.latencyMs = Date.now() - t0;
      base.inputTokens += res.usage?.inputTokens ?? 0;
      base.outputTokens += res.usage?.outputTokens ?? 0;
      const findings = (res.object as TaggingOutput).findings;
      base.findings = findings;
      base.verifiedQuotes = findings.filter(
        (f) =>
          chunk.eventIds.includes(f.quote.eventId) &&
          chunk.text.includes(f.quote.text),
      ).length;
      return { ...base, ok: true, firstTry: attempt === 0 };
    } catch (err) {
      parseError = err instanceof Error ? err.message.slice(0, 200) : String(err);
      base.latencyMs = Date.now() - t0;
    }
  }
  return { ...base, ok: false, firstTry: false, parseError };
}

function summarize(p: ProviderConfig, runs: ChunkRun[], totalChunks: number) {
  const ok = runs.filter((r) => r.ok);
  const findings = ok.flatMap((r) => r.findings);
  const perStage = Object.fromEntries(
    STAGES.map((s) => [s, findings.filter((f) => f.stage === s).length]),
  );
  const inTok = runs.reduce((a, r) => a + r.inputTokens, 0);
  const outTok = runs.reduce((a, r) => a + r.outputTokens, 0);
  const cost = estimateCostUsd(p, inTok, outTok);
  return {
    provider: p.label,
    model: p.modelId,
    chunks: runs.length,
    firstTryRate: runs.length
      ? runs.filter((r) => r.firstTry).length / runs.length
      : 0,
    jsonValidRate: runs.length ? ok.length / runs.length : 0,
    findingsTotal: findings.length,
    perStage,
    quoteVerifiedRate: findings.length
      ? ok.reduce((a, r) => a + r.verifiedQuotes, 0) / findings.length
      : 0,
    avgLatencyMs: runs.length
      ? Math.round(runs.reduce((a, r) => a + r.latencyMs, 0) / runs.length)
      : 0,
    inputTokens: inTok,
    outputTokens: outTok,
    sampleCostUsd: cost,
    estSessionCostUsd: runs.length ? (cost / runs.length) * totalChunks : 0,
  };
}

type Summary = ReturnType<typeof summarize>;

function reportMarkdown(
  logFile: string,
  totalChunks: number,
  sampled: number,
  summaries: Summary[],
): string {
  const rows = summaries
    .map(
      (s) =>
        `| ${s.provider} | ${(s.firstTryRate * 100).toFixed(0)}% → ${(s.jsonValidRate * 100).toFixed(0)}% | ${s.findingsTotal} | ` +
        `${STAGES.map((st) => s.perStage[st]).join("/")} | ` +
        `${(s.quoteVerifiedRate * 100).toFixed(0)}% | ${s.avgLatencyMs}ms | ` +
        `$${s.sampleCostUsd.toFixed(4)} | $${s.estSessionCostUsd.toFixed(4)} |`,
    )
    .join("\n");
  return `# Step 4 모델 비교 리포트

- 로그: \`${logFile}\`
- 청크: 전체 ${totalChunks}개 중 ${sampled}개 샘플 (동일 샘플·동일 프롬프트)
- 생성: ${new Date().toISOString()}

| 모델 | 유효율(1회→재시도후) | 태그 수 | 단계별(p/i/e/r) | 인용 검증율 | 평균 지연 | 샘플 비용 | 세션 추정 비용 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

- 인용 검증율: quote.text가 실제로 청크 원문에 그대로 존재하는 비율 (출처 기반 정확성).
- 세션 추정 비용: 샘플 평균 × 전체 청크 수.
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith("--"));
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const logFile = positional[0];
  if (!logFile) {
    console.error("usage: npm run eval:models -- <log file> [--chunks 10] [--seed 42]");
    process.exit(1);
  }
  const nChunks = Number(flag("chunks") ?? 10);
  const seed = Number(flag("seed") ?? 42);

  const lines = readFileSync(logFile, "utf8").split("\n");
  const session = parseSession(lines);
  const chunks = chunkSession(session);
  const sampled = sample(chunks, nChunks, seed);
  console.log(
    `parsed ${session.events.length} events → ${chunks.length} chunks, sampling ${sampled.length} (seed ${seed})`,
  );

  const summaries: Summary[] = [];
  const raw: Record<string, ChunkRun[]> = {};
  for (const p of PROVIDERS) {
    if (!isConfigured(p)) {
      console.log(`- ${p.label}: ${p.envVar} 미설정 → 건너뜀`);
      continue;
    }
    console.log(`- ${p.label} (${p.modelId}) 실행 중…`);
    const runs: ChunkRun[] = [];
    for (const chunk of sampled) {
      const run = await runChunk(p, chunk);
      runs.push(run);
      console.log(
        `  ${chunk.id}: ${run.ok ? `${run.findings.length}개 태그, 인용검증 ${run.verifiedQuotes}` : `실패(${run.parseError})`} ${run.latencyMs}ms`,
      );
    }
    raw[p.key] = runs;
    summaries.push(summarize(p, runs, chunks.length));
  }

  if (!summaries.length) {
    console.error("실행된 provider가 없습니다. .env.local의 API 키를 확인하세요.");
    process.exit(1);
  }

  const outDir = join(".parsed", "eval");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const md = reportMarkdown(logFile, chunks.length, sampled.length, summaries);
  writeFileSync(join(outDir, `report-${stamp}.md`), md);
  writeFileSync(
    join(outDir, `raw-${stamp}.json`),
    JSON.stringify({ logFile, summaries, raw }, null, 2),
  );
  console.log(`\n${md}`);
  console.log(`saved: ${outDir}/report-${stamp}.md (+ raw json, gitignored)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
