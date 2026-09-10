/**
 * 마스킹 1차: 정규식 (P4 소유 — 이 파일은 P1이 만든 시작점.
 * publish가 마스킹 없이 나가는 것을 막기 위한 최소 규칙이며,
 * P4가 규칙을 보강하고 fixture 테스트를 늘리는 것이 9/11 과제).
 *
 * 대회 규정 "타인 개인정보·기밀 포함 금지"의 직접 대응.
 * 원문 인용의 증거 가치를 해치지 않도록, 매칭된 부분만 자리표시자로 바꾼다.
 */

const RULES: { name: string; pattern: RegExp; replace: string }[] = [
  { name: "email", pattern: /[\w.+-]+@[\w-]+\.[\w.]+/g, replace: "[이메일]" },
  // 흔한 비밀 접두사: OpenAI/Upstage(sk-, up_), GitHub(gh[pousr]_), AWS(AKIA), JWT
  { name: "api-key", pattern: /\b(?:sk-[\w-]{8,}|up_[\w]{8,}|gh[pousr]_[\w]{20,}|AKIA[0-9A-Z]{16})\b/g, replace: "[API키]" },
  { name: "jwt", pattern: /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}\b/g, replace: "[토큰]" },
  { name: "bearer", pattern: /\b[Bb]earer\s+[\w~+/.=-]{16,}/g, replace: "Bearer [토큰]" },
  // 홈 경로 속 사용자명
  { name: "home-path", pattern: /\/(?:Users|home)\/[\w.-]+/g, replace: "/Users/[사용자]" },
  { name: "phone-kr", pattern: /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, replace: "[전화번호]" },
];

export function maskText(text: string): string {
  let out = text;
  for (const rule of RULES) out = out.replace(rule.pattern, rule.replace);
  return out;
}

/** 객체 안의 모든 문자열 필드를 마스킹 (PortfolioView 전체에 적용용). */
export function maskDeep<T>(value: T): T {
  if (typeof value === "string") return maskText(value) as T;
  if (Array.isArray(value)) return value.map(maskDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, maskDeep(v)]),
    ) as T;
  }
  return value;
}
