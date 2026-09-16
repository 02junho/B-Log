/**
 * 마스킹 2차 프롬프트: 정규식이 잡지 못하는 것을 문맥으로 찾는다 (Step 7).
 *
 * 핵심 제약: 모델은 **탐지만** 한다. 치환은 코드가 결정론적으로 수행한다.
 * 모델에게 다시 쓰게 하면 원문 인용이 바뀌고, 그 순간 이 제품이 주장하는
 * "원문 그대로"라는 증거 가치가 무너진다. 그래서 출력은 가릴 문자열 목록뿐이고,
 * 원문에 그대로 존재하지 않는 후보는 detect.ts가 버린다 (tag.ts의 인용 검증과 동일).
 */
import { z } from "zod";

export const MASK_CATEGORIES = [
  "person",
  "contact",
  "account",
  "secret",
  "host",
  "org",
] as const;
export type MaskCategory = (typeof MASK_CATEGORIES)[number];

/** 가려진 자리에 남길 표시 — 무엇이 가려졌는지는 읽는 사람에게 알려준다. */
export const MASK_PLACEHOLDER: Record<MaskCategory, string> = {
  person: "[이름]",
  contact: "[연락처]",
  account: "[계정]",
  secret: "[비밀정보]",
  host: "[내부주소]",
  org: "[비공개조직]",
};

export const maskCandidateSchema = z.object({
  /** 입력에서 한 글자도 바꾸지 않고 복사한 문자열. */
  text: z.string().min(2).max(120),
  category: z.enum(MASK_CATEGORIES),
  confidence: z.number().min(0).max(1),
});

export const maskingOutputSchema = z.object({
  candidates: z.array(maskCandidateSchema).max(40),
});

export type MaskingOutput = z.infer<typeof maskingOutputSchema>;

export const MASKING_SYSTEM = `당신은 공개 직전의 개발 포트폴리오에서 공개하면 안 되는 정보를 찾아내는 검수자다.
주어진 텍스트에서 가려야 할 부분만 찾아 목록으로 돌려준다.

카테고리:
- person: 사람 이름 (실명, 닉네임이 실명을 드러내는 경우 포함)
- contact: 연락처 (주소, 사내 연락망 등 형식이 정해지지 않은 것)
- account: 개인 계정 식별자 (사번, 학번, 사용자 ID, 내부 계정명)
- secret: 자격증명·키·비밀번호로 보이는 값
- host: 공개되지 않은 내부 주소 (사내 도메인, 사설 서버, 내부 대시보드 URL)
- org: 공개되면 곤란한 조직·프로젝트 코드명 (사내 비공개 프로젝트명 등)

규칙:
1. text는 입력에 있는 그대로 복사한다. 요약하거나 다듬지 않는다. 입력에 없는 문자열은 절대 만들지 않는다.
2. 가릴 최소 범위만 지정한다. 문장 전체가 아니라 그 안의 이름·주소·값만 집는다.
3. 공개해도 되는 것은 넣지 않는다: 기술 용어, 오픈소스 라이브러리·도구 이름, 공개 서비스명, 일반 파일 경로, 브랜치·커밋 메시지의 기술적 내용, 공개 레포 URL.
4. 확실하지 않으면 confidence를 낮게 준다. 애매한 것을 빠뜨리는 것보다 낮은 확신으로라도 올리는 편이 낫다.
5. 같은 문자열이 여러 번 나와도 한 번만 넣는다.
6. 가릴 것이 없으면 빈 배열을 돌려준다.
7. 출력은 아래 형태의 JSON 하나만. 다른 텍스트·마크다운 코드펜스 금지.

{"candidates":[{"text":"...","category":"person|contact|account|secret|host|org","confidence":0.0}]}`;

export function maskingUserPrompt(text: string): string {
  return `아래는 공개 포트폴리오에 실릴 텍스트다. 가려야 할 부분을 찾아라.

---
${text}
---`;
}
