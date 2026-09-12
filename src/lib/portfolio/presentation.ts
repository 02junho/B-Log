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
  return minutes < 60
    ? `${minutes}분`
    : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}`;
}
