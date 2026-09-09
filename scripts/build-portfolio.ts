/**
 * 파이프라인 전체를 CLI로: 로그 파일 → PortfolioView JSON.
 *
 *   npm run portfolio -- <log file> [--title "..."] [--slug my-slug]
 *     [--repo https://github.com/owner/repo] [--concurrency 5] [--out <file>]
 *
 * 실제 LLM(태깅)을 호출한다. 출력은 마스킹 전이므로 `.parsed/`(gitignored)
 * 기본 — 레포에 커밋하거나 공유하기 전에 반드시 내용을 검수할 것.
 * P3 fixtures와 Step 8 데모 3종의 생산 도구다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseSession } from "../src/lib/parser";
import { chunkSession } from "../src/lib/pipeline/chunk";
import { tagSession } from "../src/lib/pipeline/tag";
import { estimateCostUsd, MAIN_PROVIDER } from "../src/lib/pipeline/llm";
import { buildPortfolioView } from "../src/lib/portfolio/build";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const positional = argv.filter(
    (a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"),
  );
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const logFile = positional[0];
  if (!logFile) {
    console.error(
      'usage: npm run portfolio -- <log file> [--title "..."] [--slug s] [--repo url] [--concurrency 5] [--out file]',
    );
    process.exit(1);
  }
  const slug = flag("slug") ?? basename(logFile).replace(/\.[^.]+$/, "");
  const title = flag("title") ?? `세션 분석: ${slug}`;
  const repoUrl = flag("repo");
  const concurrency = Number(flag("concurrency") ?? 5);
  const out = flag("out") ?? join(".parsed", "portfolio", `${slug}.json`);

  const t0 = Date.now();
  const session = parseSession(readFileSync(logFile, "utf8").split("\n"));
  const chunks = chunkSession(session);
  console.log(
    `${session.source.tool} 세션: ${session.events.length} 이벤트 → ${chunks.length} 청크, 동시성 ${concurrency}`,
  );

  const tagged = await tagSession(chunks, {
    concurrency,
    onProgress: (done, total) => {
      if (done % 5 === 0 || done === total)
        console.log(`  태깅 ${done}/${total}`);
    },
  });
  const view = buildPortfolioView(session, tagged.findings, {
    slug,
    title,
    ...(repoUrl ? { repoUrl } : {}),
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(view, null, 2));

  const dropped = tagged.results.reduce((a, r) => a + r.droppedQuotes, 0);
  const cost = estimateCostUsd(
    MAIN_PROVIDER,
    tagged.inputTokens,
    tagged.outputTokens,
  );
  console.log(
    [
      "",
      `findings ${tagged.findings.length}개 (미검증 인용 ${dropped}개 제외), 실패 청크 ${tagged.failedChunks.length}개`,
      `하이라이트 ${view.highlights.length}개, 타임라인 ${view.timeline.length}줄`,
      `소요 ${((Date.now() - t0) / 1000).toFixed(1)}s, 비용 ~$${cost.toFixed(4)}`,
      `출력: ${out} (마스킹 전 — 공유 전 검수 필수)`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
