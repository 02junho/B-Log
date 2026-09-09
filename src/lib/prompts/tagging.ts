/**
 * 4-stage tagging prompt v1 (Step 4).
 *
 * Input: one rendered chunk (see pipeline/chunk.ts). Output: strict JSON,
 * validated with zod. We deliberately use plain text generation + JSON
 * parsing on every provider (not provider-specific structured output), so
 * JSON validity itself becomes a comparable quality metric in the eval.
 */
import { z } from "zod";

export const STAGES = [
  "problem", // 문제 정의
  "instruction", // AI 지시/프롬프트
  "evidence", // 근거 탐색·의사결정
  "recovery", // 실패·복구
] as const;

export const findingSchema = z.object({
  stage: z.enum(STAGES),
  /** 한 문장 요약 (한국어). */
  summary: z.string().min(4).max(200),
  quote: z.object({
    /** 인용의 근거가 되는 이벤트 id — 청크 안의 [eNNNN] 표기. */
    eventId: z.string().regex(/^e\d{4}$/),
    /** 원문에서 그대로 가져온 문자열 (변형 금지). */
    text: z.string().min(3).max(400),
  }),
  confidence: z.number().min(0).max(1),
});

export const taggingOutputSchema = z.object({
  findings: z.array(findingSchema).max(8),
});

export type TaggingOutput = z.infer<typeof taggingOutputSchema>;

export const TAGGING_SYSTEM = `당신은 개발자와 AI 코딩 도구의 협업 세션 로그를 분석하는 전문가다.
주어진 로그 조각에서 아래 4단계에 해당하는 순간을 찾아 태깅한다.

- problem: 개발자가 문제·목표·요구사항을 정의하는 순간
- instruction: 개발자가 AI에게 방향·제약·수정을 지시하는 순간 (좋은 지휘의 증거)
- evidence: 근거를 찾거나 검증하고, 그에 따라 의사결정하는 순간 (사람 또는 AI)
- recovery: 실패·오류가 드러나고 그것을 진단·복구하는 순간

규칙:
1. 로그에 실제로 있는 순간만 태깅한다. 없는 단계는 비워도 된다.
2. quote.text는 로그 원문에서 한 글자도 바꾸지 말고 그대로 복사한다. 문장 1~2개, 최대 300자의 짧은 발췌만 허용한다. quote.eventId는 그 줄 앞의 [eNNNN] id를 쓴다.
3. summary는 한국어 한 문장. 이 포트폴리오를 읽는 제3자(채용담당자)가 이해할 수 있게 쓴다.
4. 사소한 반복(단순 확인, 인사)은 태깅하지 않는다. 조각당 최대 8개, 의미 있는 것만.
5. 출력은 아래 형태의 JSON 하나만. 다른 텍스트·마크다운 코드펜스 금지.

{"findings":[{"stage":"problem|instruction|evidence|recovery","summary":"...","quote":{"eventId":"e0001","text":"..."},"confidence":0.0}]}`;

export function taggingUserPrompt(chunkText: string): string {
  return `세션 로그 조각:\n\n${chunkText}\n\nJSON:`;
}
