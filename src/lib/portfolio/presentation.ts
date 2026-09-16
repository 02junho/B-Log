import { z } from "zod";
import { STAGES, type Stage } from "./view";

export const STAGE_LABELS: Record<Stage, string> = {
  problem: "문제 정의",
  instruct: "AI 지시",
  evidence: "근거와 결정",
  recovery: "실패와 복구",
};
const count = z.number().int().nonnegative();
const stage = z.enum(STAGES);
/** Matches the Unicode letters/numbers emitted by the publish job's slugify. */
export function isPortfolioSlug(value: string): boolean {
  return (
    value.length > 0 && value.length <= 160 && /^[\p{L}\p{N}_-]+$/u.test(value)
  );
}
/** Display boundary for stored public JSON; raw session data is never loaded. */
export const portfolioDisplaySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  tools: z.array(z.string()),
  fidelity: z.enum(["structured", "transcript"]),
  summary: z.object({
    problem: z.string(),
    instruct: z.string(),
    evidence: z.string(),
    recovery: z.string(),
  }),
  timeline: z.array(
    z.object({
      ts: z.string().optional(),
      stage,
      summary: z.string(),
      quote: z.string().optional(),
      commit: z
        .object({
          sha: z.string(),
          message: z.string(),
          url: z.string(),
          method: z.enum(["log", "time", "embed"]).optional(),
        })
        .optional(),
    }),
  ),
  highlights: z.array(
    z.object({ stage, title: z.string(), quote: z.string(), why: z.string() }),
  ),
  stats: z.object({
    events: count,
    toolCalls: count,
    commits: count,
    durationMin: count.optional(),
    byRole: z.object({ user: count, assistant: count, tool: count }),
  }),
  /** 마스킹 2차 이전에 만들어진 초안에는 없다 — optional이어야 옛 행이 계속 열린다. */
  masking: z
    .object({
      level: z.enum(["regex+llm", "regex-only"]),
      regexTotal: count,
      llmApplied: count,
      llmRejected: count,
      degradedReason: z.string().optional(),
    })
    .optional(),
});
export function safeCommitUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      !url.username &&
      !url.password &&
      /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}\/?$/i.test(url.pathname)
    )
      return url.href;
  } catch {
    /* Missing or invalid links render as text. */
  }
}
/** 타임라인 날짜 구분용 — 같은 날인지 판별하는 키 (서울 기준). */
export function dayKeyOf(value?: string): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  }).format(new Date(value));
}

/** 날짜 구분선 라벨: "9월 6일 (토)". 여러 날에 걸친 세션에서 시각만 보이면
 * 순서가 왜곡돼 보인다 — 날짜가 바뀔 때마다 이 라벨을 끼운다. */
export function displayDate(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

export function displayTime(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return "시간 미기록";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function displayDuration(minutes?: number): string {
  if (minutes === undefined) return "미기록";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  // 하루를 넘는 세션은 "147시간"보다 "6일 3시간"이 한눈에 읽힌다.
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return `${days}일${restHours ? ` ${restHours}시간` : ""}`;
  }
  return `${hours}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}`;
}
