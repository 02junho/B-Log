/**
 * 마스킹 1차: 정규식 (P4 소유 폴더 — P1이 만든 시작점을 보강).
 *
 * 대회 규정 "타인 개인정보·기밀 포함 금지"의 직접 대응.
 * 원문 인용의 증거 가치를 해치지 않도록, 매칭된 부분만 자리표시자로 바꾼다.
 * 여기서 확실히 잡히는 것만 다루고, 사람 이름처럼 문맥이 필요한 것은
 * 2차(LLM 탐지, ./detect.ts)가 맡는다.
 */

interface MaskRule {
  name: string;
  pattern: RegExp;
  /** 문자열이면 그대로 치환. 함수가 원본을 그대로 돌려주면 치환하지 않는다. */
  replace: string | ((match: string) => string);
}

/** 숫자열이 실제 카드번호인지 — 자릿수만 보고 마스킹하면 오탐이 너무 많다. */
function isLuhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** 개인 정보가 아닌 주소는 남긴다 — 로컬 주소가 가려지면 로그가 안 읽힌다. */
const PUBLIC_IPS = new Set(["0.0.0.0", "127.0.0.1", "255.255.255.255", "8.8.8.8"]);

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  );
}

const RULES: MaskRule[] = [
  // 키 블록이 먼저 — 뒤의 규칙이 블록 내부를 부분적으로 먹지 않게 한다.
  {
    name: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: "[비밀키]",
  },
  {
    name: "connection-string",
    pattern: /\b([a-z][a-z0-9+.-]*):\/\/([^\s:/@]+):([^\s/@]+)@/gi,
    replace: (match) => `${match.split("://")[0]}://[계정]:[비밀번호]@`,
  },
  { name: "email", pattern: /[\w.+-]+@[\w-]+\.[\w.]+/g, replace: "[이메일]" },
  // 흔한 비밀 접두사: OpenAI/Upstage(sk-, up_), GitHub(gh[pousr]_), AWS(AKIA)
  {
    name: "api-key",
    pattern: /\b(?:sk-[\w-]{8,}|up_[\w]{8,}|gh[pousr]_[\w]{20,}|AKIA[0-9A-Z]{16})\b/g,
    replace: "[API키]",
  },
  { name: "jwt", pattern: /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}\b/g, replace: "[토큰]" },
  { name: "bearer", pattern: /\b[Bb]earer\s+[\w~+/.=-]{16,}/g, replace: "Bearer [토큰]" },
  {
    name: "webhook",
    pattern: /https:\/\/(?:hooks\.slack\.com|discord(?:app)?\.com\/api\/webhooks)\/[\w/-]+/g,
    replace: "[웹훅URL]",
  },
  // 홈 경로 속 사용자명 — POSIX와 Windows 양쪽. 이 팀은 Windows에서 개발하므로
  // C:\Users\<이름>이 로그 전체에 깔린다. 한쪽만 막으면 없느니만 못하다.
  { name: "home-path", pattern: /\/(?:Users|home)\/[\w.-]+/g, replace: "/Users/[사용자]" },
  {
    name: "home-path-win",
    pattern: /\b[A-Za-z]:\\Users\\[^\\/:*?"<>|\r\n]+/g,
    replace: "C:\\Users\\[사용자]",
  },
  { name: "phone-kr", pattern: /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, replace: "[전화번호]" },
  {
    name: "krrn",
    pattern: /\b\d{6}[-\s]?[1-4]\d{6}\b/g,
    replace: "[주민번호]",
  },
  {
    name: "card",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replace: (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && isLuhnValid(digits)
        ? "[카드번호]"
        : match;
    },
  },
  {
    name: "ipv4",
    pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
    replace: (match) => (isIpv4(match) && !PUBLIC_IPS.has(match) ? "[IP]" : match),
  },
];

function applyRule(text: string, rule: MaskRule, tally?: Map<string, number>): string {
  return text.replace(rule.pattern, (match) => {
    const replaced =
      typeof rule.replace === "function" ? rule.replace(match) : rule.replace;
    if (replaced === match) return match;
    if (tally) tally.set(rule.name, (tally.get(rule.name) ?? 0) + 1);
    return replaced;
  });
}

export function maskText(text: string, tally?: Map<string, number>): string {
  let out = text;
  for (const rule of RULES) out = applyRule(out, rule, tally);
  return out;
}

/** 객체 안의 모든 문자열 필드를 마스킹 (PortfolioView 전체에 적용용). */
export function maskDeep<T>(value: T, tally?: Map<string, number>): T {
  if (typeof value === "string") return maskText(value, tally) as T;
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, tally)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, maskDeep(v, tally)]),
    ) as T;
  }
  return value;
}

export interface RegexMaskResult<T> {
  masked: T;
  /** 규칙별 치환 횟수. 검수 화면이 "무엇이 가려졌는지" 보여주는 재료. */
  hits: Record<string, number>;
  total: number;
}

export function maskDeepCounted<T>(value: T): RegexMaskResult<T> {
  const tally = new Map<string, number>();
  const masked = maskDeep(value, tally);
  const hits = Object.fromEntries(tally);
  const total = [...tally.values()].reduce((a, b) => a + b, 0);
  return { masked, hits, total };
}

export const MASK_RULE_NAMES = RULES.map((r) => r.name);
