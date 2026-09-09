import { gitCommitFrom } from "../git";
import {
  eventId,
  type BLogEvent,
  type GitCommitRef,
  type SessionAdapter,
  type ToolCall,
  type ToolResult,
} from "../schema";
import { isRecord, joinTextBlocks, parseLine } from "../util";

/** Tools whose result reports a confirmed write. Read/Glob touch files too. */
const WRITE_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);

/**
 * Slash-command echoes and host notifications ride in user records but are not
 * the user instructing the AI; counting them would inflate the "AI 지시" stage.
 */
const HOST_ONLY_TEXT =
  /^\s*<(?:command-name|command-message|command-args|local-command-stdout|local-command-caveat|task-notification|ci-monitor-event)\b/;
const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

/**
 * The host injects reminders into user messages and tool output alike. They are
 * instructions to the model, never part of the collaboration, and letting them
 * reach the tagging prompt would put someone else's directives in the analysis.
 */
function stripReminders(raw: string): string {
  return raw.replace(SYSTEM_REMINDER, "");
}

function userText(raw: string): string {
  if (HOST_ONLY_TEXT.test(raw)) return "";
  return stripReminders(raw).trim();
}

/** Both shell tools name their argument `command`. */
function commandOf(input: unknown): string {
  return isRecord(input) && typeof input.command === "string" ? input.command : "";
}

function confirmedSha(detail: unknown): string | undefined {
  if (!isRecord(detail) || !isRecord(detail.gitOperation)) return undefined;
  const commit = detail.gitOperation.commit;
  return isRecord(commit) && typeof commit.sha === "string" ? commit.sha : undefined;
}

/**
 * Claude Code JSONL → one normalized session, in file order.
 *
 * Only `user` and `assistant` records carry the conversation; every other
 * record type (attachment, system, queue-operation, titles, …) is host
 * bookkeeping and is ignored, which also keeps the adapter forward compatible.
 * Thinking blocks are dropped for the same reason Codex reasoning is: they are
 * the model's private draft, not the collaboration being documented.
 */
export const parseClaudeCode: SessionAdapter = (lines) => {
  const events: BLogEvent[] = [];
  const calls = new Map<string, { name: string; input: unknown }>();
  let cwd: string | undefined;
  let startedAt: string | undefined;

  for (const [index, line] of lines.entries()) {
    const entry = parseLine(line, index, "Claude Code");
    if (!isRecord(entry)) continue;
    if (typeof entry.cwd === "string" && !cwd) cwd = entry.cwd;
    if (typeof entry.timestamp === "string" && !startedAt) startedAt = entry.timestamp;
    if (entry.type !== "user" && entry.type !== "assistant") continue;
    // Sidechains are subagent transcripts; the main thread keeps the Task call
    // and its result, so including them would duplicate the same work twice.
    if (entry.isMeta === true || entry.isSidechain === true) continue;
    if (!isRecord(entry.message)) continue;

    const content = entry.message.content;
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];
    let text = "";

    if (typeof content === "string") {
      text = userText(content);
    } else if (Array.isArray(content)) {
      const parts: string[] = [];
      for (const block of content) {
        if (!isRecord(block)) continue;
        if (block.type === "text" && typeof block.text === "string") {
          const cleaned = entry.type === "user" ? userText(block.text) : stripReminders(block.text);
          if (cleaned) parts.push(cleaned);
        } else if (block.type === "tool_use") {
          if (typeof block.id !== "string" || typeof block.name !== "string") continue;
          calls.set(block.id, { name: block.name, input: block.input });
          toolCalls.push({ id: block.id, name: block.name, input: block.input });
        } else if (block.type === "tool_result") {
          if (typeof block.tool_use_id !== "string") continue;
          toolResults.push({
            callId: block.tool_use_id,
            output: stripReminders(joinTextBlocks(block.content, ["text"])),
            ...(block.is_error === true ? { isError: true } : {}),
          });
        }
      }
      text = parts.join("\n");
    }

    if (!text && !toolCalls.length && !toolResults.length) continue;

    // `toolUseResult` is a single object, so it can only be attributed when the
    // record carries exactly one result. Otherwise no write or commit is claimed.
    let filesChanged: string[] | undefined;
    let gitCommit: GitCommitRef | undefined;
    const only = toolResults.length === 1 ? toolResults[0] : undefined;
    const call = only ? calls.get(only.callId) : undefined;
    const detail = entry.toolUseResult;

    if (only && call && !only.isError) {
      if (WRITE_TOOLS.has(call.name) && isRecord(detail) && typeof detail.filePath === "string") {
        filesChanged = [detail.filePath];
      } else if (SHELL_TOOLS.has(call.name)) {
        const stdout = isRecord(detail) && typeof detail.stdout === "string" ? detail.stdout : only.output;
        gitCommit = gitCommitFrom(commandOf(call.input), stdout, confirmedSha(detail));
      }
    }

    events.push({
      id: eventId(events.length),
      role: toolResults.length ? "tool" : entry.type,
      ...(typeof entry.timestamp === "string" ? { ts: entry.timestamp } : {}),
      text,
      ...(toolCalls.length ? { toolCalls } : {}),
      ...(toolResults.length ? { toolResults } : {}),
      ...(filesChanged ? { filesChanged } : {}),
      ...(gitCommit ? { gitCommit } : {}),
    });
  }

  return {
    source: { tool: "claude-code", fidelity: "structured" },
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    events,
  };
};
