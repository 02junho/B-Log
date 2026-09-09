import type { SourceTool } from "./schema";
import { isRecord } from "./util";

/** Record types unique to each structured log format. */
const CODEX_TYPES = new Set([
  "session_meta",
  "response_item",
  "event_msg",
  "turn_context",
  "token_usage_record",
  "world_state",
  "compacted",
]);
const CLAUDE_TYPES = new Set([
  "user",
  "assistant",
  "attachment",
  "system",
  "summary",
  "queue-operation",
  "last-prompt",
  "custom-title",
  "ai-title",
  "mode",
  "atis-latch",
  "bridge-session",
  "file-history-snapshot",
]);

const SAMPLE_LINES = 30;

/**
 * Pick the input gate from the first records. Both formats are JSONL with a
 * `type` field, so the type vocabulary decides — not the first line alone,
 * which can be host bookkeeping in either tool. Anything we cannot recognize
 * falls through to the transcript gate rather than failing the upload.
 */
export function detectFormat(lines: readonly string[]): SourceTool {
  let codex = 0;
  let claude = 0;
  let seen = 0;

  for (const line of lines) {
    if (seen >= SAMPLE_LINES) break;
    const trimmed = line.replace(/^\uFEFF/, "").trim();
    if (!trimmed) continue;
    seen++;
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!isRecord(entry) || typeof entry.type !== "string") continue;
    if (CODEX_TYPES.has(entry.type)) codex++;
    // `type: "user"` alone is weak; Claude Code always stamps session bookkeeping.
    else if (CLAUDE_TYPES.has(entry.type) && (entry.sessionId !== undefined || entry.uuid !== undefined)) claude++;
  }

  if (!codex && !claude) return "transcript";
  return codex >= claude ? "codex" : "claude-code";
}
