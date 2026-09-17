/**
 * 4-stage tagging prompt v1 (Step 4).
 *
 * Input: one rendered chunk (see pipeline/chunk.ts). Output: strict JSON,
 * validated with zod. We deliberately use plain text generation + JSON
 * parsing on every provider (not provider-specific structured output), so
 * JSON validity itself becomes a comparable quality metric in the eval.
 */
import { z } from "zod";
import { STAGES } from "../portfolio/view";

/** 단계 어휘는 계약(portfolio/view.ts = DB findings.stage)과 동일해야 한다. */
export { STAGES };

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

- problem: 개발자가 해결할 문제·목표·원하는 결과를 설명하는 순간
- instruct: 사용자(개발자)가 AI에게 실행 순서·방법·제약·수정을 구체적으로 요청하는 순간 (AI 활용 방식의 증거)
- evidence: 결론의 근거가 되는 관찰·검증 결과를 확인하는 순간 (수정 후 성공 검증 포함, 사람 또는 AI)
- recovery: 실패·오류가 드러나거나 그 원인을 진단하고 구체적인 복구 행동을 정하는 순간

규칙:
1. 로그에 실제로 있는 순간만 태깅한다. 없는 단계는 비워도 된다.
2. quote.text는 로그 원문에서 한 글자도 바꾸지 말고 그대로 복사한다. 문장 1~2개, 최대 300자의 짧은 발췌만 허용한다. quote.eventId는 그 줄 앞의 [eNNNN] id를 쓴다.
3. summary는 한국어 한 문장. 이 포트폴리오를 읽는 제3자(채용담당자)가 이해할 수 있게 쓴다.
4. 사소한 반복(단순 확인, 인사)은 태깅하지 않는다. 조각당 최대 8개, 의미 있는 것만.
5. problem과 instruct는 배타적이지 않다. 한 사용자 발화가 문제를 설명하면서 작업 방법도 지시하면 같은 eventId로 두 finding을 만들고, 각 단계에 해당하는 최소 원문 구절을 따로 인용한다.
6. instruct의 quote는 반드시 [eNNNN] user: 발화에서 가져온다. assistant의 계획("확인하겠습니다", "수정하겠습니다")이나 도구 호출을 사용자 지시로 분류하지 않는다.
7. 실패 사실·진단·복구 행동은 recovery다. 수정 후 테스트 통과처럼 성공 여부만 확인하는 검증 결과는 evidence이며, recovery로 중복 태깅하지 않는다.
8. 출력은 아래 형태의 JSON 하나만. 다른 텍스트·마크다운 코드펜스 금지.

경계 예시:
- [e0001] user: 로그인 오류가 난다.
  → problem: "로그인 오류가 난다."
- [e0002] user: 로그인 오류를 고치고 먼저 실패 테스트를 추가해.
  → problem: "로그인 오류"
  → instruct: "로그인 오류를 고치고 먼저 실패 테스트를 추가해."
- [e0003] user: 테스트가 실패했다.
  → recovery: "테스트가 실패했다."
- [e0004] user: 실패 원인이 캐시임을 로그로 확인했다.
  → evidence: "실패 원인이 캐시임을 로그로 확인했다."
- [e0005] assistant: 수정 후 회귀 테스트 3개가 모두 통과했습니다.
  → evidence: "수정 후 회귀 테스트 3개가 모두 통과했습니다."
  → recovery로 태깅하지 않는다.
- [e0006] assistant: 원인을 확인하고 수정하겠습니다.
  → instruct로 태깅하지 않는다.

{"findings":[{"stage":"problem|instruct|evidence|recovery","summary":"...","quote":{"eventId":"e0001","text":"..."},"confidence":0.0}]}`;

export function taggingUserPrompt(chunkText: string): string {
  return `세션 로그 조각:\n\n${chunkText}\n\nJSON:`;
}
