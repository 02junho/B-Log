import { gitCommitFrom } from "../git";
import {
  eventId,
  type BLogEvent,
  type SessionAdapter,
} from "../schema";
import { isRecord, joinTextBlocks, parseLine } from "../util";

function decodeInput(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Codex reports a shell exit either as metadata or as its own last line. */
const EXIT_LINE = /^Process exited with code (-?\d+)\b/m;

function stripReminders(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?(?:<\/system-reminder>|$)/g, "");
}

function userText(text: string): string {
  return text.replace(/<(recommended_plugins|environment_context)>[\s\S]*?<\/\1>/g, "").trim();
}

function decodeOutput(output: string): { report: string; exitCode?: number } {
  const decoded = decodeInput(output);
  const wrapped = isRecord(decoded) ? decoded : undefined;
  const report =
    wrapped && typeof wrapped.output === "string" ? wrapped.output : output;

  const meta = wrapped && isRecord(wrapped.metadata) ? wrapped.metadata : undefined;
  if (meta && typeof meta.exit_code === "number") return { report, exitCode: meta.exit_code };
  if (wrapped && typeof wrapped.exit_code === "number") return { report, exitCode: wrapped.exit_code };

  // A wrapper without metadata still prints the exit line inside its output.
  const exit = EXIT_LINE.exec(report);
  return { report, ...(exit ? { exitCode: Number(exit[1]) } : {}) };
}

/** Desktop script tools emit separate command envelopes, one JSON object per line.
 * Keep their outcomes separate: one failed sibling must not erase another's commit.
 * Only unwrap host-shaped records; arbitrary JSON in command stdout is not status.
 */
function outputReports(output: string): ReturnType<typeof decodeOutput>[] {
  function hostReport(value: unknown): ReturnType<typeof decodeOutput> | undefined {
    // Promise.allSettled describes the JS promise, not the shell exit status.
    // Only unwrap a fulfilled value carrying the full command envelope shape.
    const envelope = isRecord(value) && value.status === "fulfilled" ? value.value : value;
    if (!isRecord(envelope) || typeof envelope.chunk_id !== "string" ||
      typeof envelope.wall_time_seconds !== "number" || typeof envelope.output !== "string") return undefined;
    return decodeOutput(JSON.stringify(envelope));
  }

  const whole = decodeInput(output);
  if (isRecord(whole) && typeof whole.output === "string") return [decodeOutput(output)];
  const single = hostReport(whole);
  if (single) return [single];
  const reports = output.split(/\r?\n/).flatMap((line) => {
    const report = hostReport(decodeInput(line));
    return report ? [report] : [];
  });
  return reports.length ? reports : [decodeOutput(output)];
}

/** Extract only apply_patch's success report; never infer writes from a command. */
function changedPaths(report: string): string[] {
  const lines = report.split(/\r?\n/);
  const start = lines.indexOf("Success. Updated the following files:");
  if (start < 0) return [];
  const paths: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^[AMD] (.+)$/.exec(line);
    if (!match) break;
    paths.push(match[1]);
  }
  return [...new Set(paths)];
}

function isPatchTool(name: string | undefined): boolean {
  return name === "apply_patch" || !!name?.endsWith("__apply_patch") || !!name?.endsWith(".apply_patch");
}

/** Shell arguments differ per tool version; a script tool keeps its raw text. */
function commandOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (!isRecord(input)) return "";
  if (typeof input.cmd === "string") return input.cmd;
  if (typeof input.command === "string") return input.command;
  if (Array.isArray(input.command)) return input.command.filter((part) => typeof part === "string").join(" ");
  return "";
}

/**
 * Codex rollout JSONL → one normalized session, in file order.
 * response_item is authoritative: event_msg mirrors are deliberately ignored.
 * Unknown records are ignored for forward compatibility. Invalid JSON throws a
 * line-only error so a corrupt upload cannot silently become a partial analysis.
 */
export const parseCodex: SessionAdapter = (lines) => {
  const events: BLogEvent[] = [];
  const calls = new Map<string, { name: string; input: unknown }>();
  let cwd: string | undefined;
  let startedAt: string | undefined;

  for (const [index, line] of lines.entries()) {
    const entry = parseLine(line, index, "Codex");
    if (!isRecord(entry)) continue;
    if (typeof entry.timestamp === "string" && !startedAt) startedAt = entry.timestamp;
    if (entry.type === "session_meta" && isRecord(entry.payload)) {
      if (typeof entry.payload.cwd === "string" && !cwd) cwd = entry.payload.cwd;
      continue;
    }
    if (entry.type !== "response_item" || !isRecord(entry.payload)) continue;
    const item = entry.payload;
    const base = {
      id: eventId(events.length),
      ...(typeof entry.timestamp === "string" ? { ts: entry.timestamp } : {}),
    };

    if (item.type === "message") {
      if (item.role !== "user" && item.role !== "assistant") continue;
      if (item.channel === "analysis" || item.phase === "analysis") continue;
      if (!Array.isArray(item.content)) continue;
      const cleaned = stripReminders(joinTextBlocks(item.content, ["input_text", "output_text"]));
      const text = item.role === "user" ? userText(cleaned) : cleaned;
      // Codex also injects repository and environment instructions as user items.
      if (
        item.role === "user" &&
        /^(?:# AGENTS\.md instructions for |<environment_context>|<permissions instructions>|<INSTRUCTIONS>)/.test(
          text.trimStart(),
        )
      ) {
        continue;
      }
      if (text.trim()) events.push({ ...base, role: item.role, text });
    } else if (item.type === "function_call" || item.type === "custom_tool_call") {
      const input = item.type === "function_call" ? item.arguments : item.input;
      if (typeof item.call_id !== "string" || typeof item.name !== "string" || typeof input !== "string") continue;
      const decoded = item.type === "function_call" ? decodeInput(input) : input;
      calls.set(item.call_id, { name: item.name, input: decoded });
      events.push({
        ...base,
        role: "assistant",
        text: "",
        toolCalls: [{ id: item.call_id, name: item.name, input: decoded }],
      });
    } else if (item.type === "function_call_output" || item.type === "custom_tool_call_output") {
      if (typeof item.call_id !== "string") continue;
      // Tool output blocks are labelled input_text: they are the model's next input.
      const output = stripReminders(joinTextBlocks(item.output, ["text", "output_text", "input_text"]));
      const reports = outputReports(output);
      const failed = reports.some(({ exitCode }) => exitCode !== undefined && exitCode !== 0);
      const successful = reports.filter(({ exitCode }) => exitCode === undefined || exitCode === 0);
      const call = calls.get(item.call_id);
      const files = isPatchTool(call?.name)
        ? [...new Set(successful.flatMap(({ report }) => changedPaths(report)))] : [];
      const gitCommit = !call ? undefined : successful
        .map(({ report }) => gitCommitFrom(commandOf(call.input), report))
        .find((commit) => commit !== undefined);
      events.push({
        ...base,
        role: "tool",
        text: "",
        toolResults: [{ callId: item.call_id, output, ...(failed ? { isError: true } : {}) }],
        ...(files.length ? { filesChanged: files } : {}),
        ...(gitCommit ? { gitCommit } : {}),
      });
    }
  }

  return {
    source: { tool: "codex", fidelity: "structured" },
    ...(cwd ? { cwd } : {}),
    ...(startedAt ? { startedAt } : {}),
    events,
  };
};
