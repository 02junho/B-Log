/**
 * 정답 stage가 있는 합성 요청으로 태깅 프롬프트를 A/B 평가한다.
 *
 *   npm run eval:tagging
 *   npm run eval:tagging -- --variant candidate
 *
 * 결과는 원문 취급이 필요한 일반 로그 평가와 같은 `.parsed/eval/` 아래에 저장한다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import fixture from "../../tests/fixtures/tagging-golden.json";
import type { Chunk } from "../../src/lib/pipeline/chunk";
import { getModel, isConfigured, MAIN_PROVIDER } from "../../src/lib/pipeline/llm";
import { tagChunk, type ChunkRunner } from "../../src/lib/pipeline/tag";
import {
  STAGES,
  taggingOutputSchema,
  taggingUserPrompt,
  type TaggingOutput,
} from "../../src/lib/prompts/tagging";
import type { Stage } from "../../src/lib/portfolio/view";
import { TAGGING_PROMPT_VARIANTS } from "./tagging-prompts";

export interface TaggingGoldenCase {
  id: string;
  eventId: string;
  text: string;
  expectedStages: Stage[];
  instructKind?: "short-command" | "constraint" | "continuation";
}

export interface TaggingPrediction {
  id: string;
  predictedStages: Stage[];
}

export interface StageScore {
  expected: number;
  predicted: number;
  hits: number;
  precision: number;
  recall: number;
}

export interface RecallScore {
  cases: number;
  exactMatches: number;
  exactMatchRate: number;
  macroRecall: number;
  perStage: Record<Stage, StageScore>;
}

const uniqueStages = (stages: readonly Stage[]): Stage[] =>
  STAGES.filter((stage) => stages.includes(stage));

export function scoreTaggingCases(
  cases: readonly TaggingGoldenCase[],
  predictions: readonly TaggingPrediction[],
): RecallScore {
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
  const perStage = Object.fromEntries(
    STAGES.map((stage) => {
      const expected = cases.filter((item) => item.expectedStages.includes(stage)).length;
      const predicted = cases.filter((item) =>
        byId.get(item.id)?.predictedStages.includes(stage),
      ).length;
      const hits = cases.filter(
        (item) =>
          item.expectedStages.includes(stage) &&
          byId.get(item.id)?.predictedStages.includes(stage),
      ).length;
      return [
        stage,
        {
          expected,
          predicted,
          hits,
          precision: predicted ? hits / predicted : 0,
          recall: expected ? hits / expected : 0,
        },
      ];
    }),
  ) as Record<Stage, StageScore>;

  const exactMatches = cases.filter((item) => {
    const expected = uniqueStages(item.expectedStages);
    const predicted = uniqueStages(byId.get(item.id)?.predictedStages ?? []);
    return (
      expected.length === predicted.length &&
      expected.every((stage, index) => stage === predicted[index])
    );
  }).length;

  return {
    cases: cases.length,
    exactMatches,
    exactMatchRate: cases.length ? exactMatches / cases.length : 0,
    macroRecall:
      STAGES.reduce((sum, stage) => sum + perStage[stage].recall, 0) / STAGES.length,
    perStage,
  };
}

const makeRunner = (system: string): ChunkRunner => async (chunk) => {
  const result = await generateObject({
    model: getModel(MAIN_PROVIDER),
    schema: taggingOutputSchema,
    system,
    prompt: taggingUserPrompt(chunk.text),
    maxOutputTokens: 2000,
  });
  return {
    output: result.object as TaggingOutput,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  };
};

function asChunk(item: TaggingGoldenCase, index: number): Chunk {
  return {
    id: `g${String(index + 1).padStart(3, "0")}`,
    eventIds: [item.eventId],
    text: `[${item.eventId}] user: ${item.text}`,
  };
}

interface VariantResult {
  key: string;
  label: string;
  score: RecallScore;
  predictions: Array<
    TaggingPrediction & {
      expectedStages: Stage[];
      ok: boolean;
      droppedQuotes: number;
    }
  >;
  inputTokens: number;
  outputTokens: number;
}

async function evaluateVariant(
  variant: (typeof TAGGING_PROMPT_VARIANTS)[number],
  cases: readonly TaggingGoldenCase[],
): Promise<VariantResult> {
  const predictions: VariantResult["predictions"] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (const [index, item] of cases.entries()) {
    const result = await tagChunk(asChunk(item, index), makeRunner(variant.system));
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    const predictedStages = uniqueStages(result.findings.map((finding) => finding.stage));
    predictions.push({
      id: item.id,
      expectedStages: item.expectedStages,
      predictedStages,
      ok: result.ok,
      droppedQuotes: result.droppedQuotes,
    });
    console.log(
      `  ${item.id}: expected=${item.expectedStages.join("+")} predicted=${predictedStages.join("+") || "none"}`,
    );
  }

  return {
    key: variant.key,
    label: variant.label,
    score: scoreTaggingCases(cases, predictions),
    predictions,
    inputTokens,
    outputTokens,
  };
}

const percent = (value: number): string => `${(value * 100).toFixed(0)}%`;

function reportMarkdown(results: readonly VariantResult[]): string {
  const rows = results
    .map(
      (result) =>
        `| ${result.label} | ${percent(result.score.exactMatchRate)} | ${percent(result.score.macroRecall)} | ` +
        `${STAGES.map((stage) => percent(result.score.perStage[stage].recall)).join(" / ")} | ` +
        `${STAGES.map((stage) => percent(result.score.perStage[stage].precision)).join(" / ")} |`,
    )
    .join("\n");
  return `# 태깅 정답 fixture A/B

- 사례 수: ${results[0]?.score.cases ?? 0}
- 생성: ${new Date().toISOString()}

| 프롬프트 | exact match | macro recall | 단계별 recall (p/i/e/r) | 단계별 precision (p/i/e/r) |
| --- | --- | --- | --- | --- |
${rows}
`;
}

async function main(): Promise<void> {
  if (!isConfigured(MAIN_PROVIDER)) {
    throw new Error(`${MAIN_PROVIDER.envVar}가 없어 정답 fixture 평가를 실행할 수 없습니다.`);
  }

  const args = process.argv.slice(2);
  const variantIndex = args.indexOf("--variant");
  const selected = variantIndex >= 0 ? args[variantIndex + 1] : "both";
  const variants = TAGGING_PROMPT_VARIANTS.filter(
    (variant) => selected === "both" || variant.key === selected,
  );
  if (!variants.length) {
    throw new Error("--variant는 baseline, candidate, both 중 하나여야 합니다.");
  }

  const cases = fixture as TaggingGoldenCase[];
  const results: VariantResult[] = [];
  for (const variant of variants) {
    console.log(`- ${variant.label} 평가 중…`);
    results.push(await evaluateVariant(variant, cases));
  }

  const outDir = join(".parsed", "eval");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const report = reportMarkdown(results);
  writeFileSync(join(outDir, `tagging-recall-${stamp}.md`), report);
  writeFileSync(
    join(outDir, `tagging-recall-${stamp}.json`),
    JSON.stringify({ results }, null, 2),
  );
  console.log(`\n${report}`);
  console.log(`saved: ${outDir}/tagging-recall-${stamp}.md (+ json)`);
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
