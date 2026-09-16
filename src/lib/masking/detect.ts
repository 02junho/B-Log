/**
 * 마스킹 2차: LLM 탐지 + 결정론적 치환 (Step 7).
 *
 * 순서는 정규식 1차 → LLM 2차다. 모델은 가릴 문자열만 지목하고, 치환은 여기서
 * 코드가 한다. 모델이 돌려준 문자열이 원문에 그대로 없으면 버린다 —
 * pipeline/tag.ts가 검증 안 된 인용을 버리는 것과 같은 규율이다.
 *
 * 실패는 열린 채로 두지 않는다: LLM이 죽어도 발행은 정규식 결과로 진행하되,
 * 열화 사실을 report에 남겨 검수 화면이 사람에게 경고한다 (9/13 결정).
 */
import { generateObject } from "ai";
import { getModel, isConfigured, MAIN_PROVIDER } from "../pipeline/llm";
import {
  MASK_PLACEHOLDER,
  MASKING_SYSTEM,
  maskingOutputSchema,
  maskingUserPrompt,
  type MaskCategory,
  type MaskingOutput,
} from "../prompts/masking";
import { maskDeepCounted } from "./rules";

export type MaskRunner = (text: string) => Promise<{
  output: MaskingOutput;
  inputTokens: number;
  outputTokens: number;
}>;

export const llmMaskRunner: MaskRunner = async (text) => {
  const res = await generateObject({
    model: getModel(MAIN_PROVIDER),
    schema: maskingOutputSchema,
    system: MASKING_SYSTEM,
    prompt: maskingUserPrompt(text),
    maxOutputTokens: 1500,
  });
  return {
    output: res.object as MaskingOutput,
    inputTokens: res.usage?.inputTokens ?? 0,
    outputTokens: res.usage?.outputTokens ?? 0,
  };
};

/** 검수 화면이 "무엇을 믿고 보면 되는지" 판단하는 근거. */
export interface MaskingReport {
  /** regex+llm = 2단계 모두 적용, regex-only = 2차가 돌지 않은 열화 상태. */
  level: "regex+llm" | "regex-only";
  regexHits: Record<string, number>;
  regexTotal: number;
  /** 실제로 가려진 LLM 후보 수. */
  llmApplied: number;
  /** 원문에 그대로 없어서 버린 후보 수 (모델이 지어낸 것). */
  llmRejected: number;
  categories: Partial<Record<MaskCategory, number>>;
  /** 열화 사유 (사용자에게 보여줄 짧은 한국어 문장). */
  degradedReason?: string;
}

const MIN_CONFIDENCE = 0.3;
/** 자리표시자 자체를 다시 가리려는 후보는 무의미하다. */
const PLACEHOLDER = /^\[[^\]]+\]$/;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

function replaceAllDeep<T>(value: T, from: string, to: string): T {
  if (typeof value === "string") return value.split(from).join(to) as T;
  if (Array.isArray(value)) {
    return value.map((v) => replaceAllDeep(v, from, to)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, replaceAllDeep(v, from, to)]),
    ) as T;
  }
  return value;
}

/**
 * 정규식 1차 + LLM 2차를 적용한 사본과 그 보고서를 돌려준다.
 * 입력은 변경하지 않는다.
 */
export async function maskPortfolio<T>(
  view: T,
  runner: MaskRunner | null = llmMaskRunner,
): Promise<{ masked: T; report: MaskingReport }> {
  const { masked: afterRegex, hits, total } = maskDeepCounted(view);
  const base: MaskingReport = {
    level: "regex-only",
    regexHits: hits,
    regexTotal: total,
    llmApplied: 0,
    llmRejected: 0,
    categories: {},
  };

  if (!runner) {
    return {
      masked: afterRegex,
      report: { ...base, degradedReason: "LLM 검출을 건너뛰도록 설정됨" },
    };
  }
  if (runner === llmMaskRunner && !isConfigured(MAIN_PROVIDER)) {
    return {
      masked: afterRegex,
      report: { ...base, degradedReason: "LLM 키가 설정되지 않음" },
    };
  }

  const strings: string[] = [];
  collectStrings(afterRegex, strings);
  if (!strings.length) return { masked: afterRegex, report: { ...base, level: "regex+llm" } };

  let output: MaskingOutput;
  try {
    ({ output } = await runner(strings.join("\n---\n")));
  } catch {
    // 사유는 제품 문구로만 남긴다. provider 오류 상세는 화면에 흘리지 않는다.
    return {
      masked: afterRegex,
      report: { ...base, degradedReason: "LLM 검출 호출이 실패함" },
    };
  }

  const seen = new Set<string>();
  const accepted: { text: string; category: MaskCategory }[] = [];
  let rejected = 0;
  for (const c of output.candidates) {
    const text = c.text.trim();
    if (!text || seen.has(text)) continue;
    if (c.confidence < MIN_CONFIDENCE || PLACEHOLDER.test(text)) continue;
    // 원문에 그대로 없으면 모델이 지어낸 것이다. 버린다.
    if (!strings.some((s) => s.includes(text))) {
      rejected++;
      continue;
    }
    seen.add(text);
    accepted.push({ text, category: c.category });
  }

  // 긴 후보부터 치환해야 짧은 후보가 긴 후보의 일부를 먼저 먹지 않는다.
  accepted.sort((a, b) => b.text.length - a.text.length);
  let masked = afterRegex;
  const categories: Partial<Record<MaskCategory, number>> = {};
  for (const { text, category } of accepted) {
    masked = replaceAllDeep(masked, text, MASK_PLACEHOLDER[category]);
    categories[category] = (categories[category] ?? 0) + 1;
  }

  return {
    masked,
    report: {
      ...base,
      level: "regex+llm",
      llmApplied: accepted.length,
      llmRejected: rejected,
      categories,
    },
  };
}
