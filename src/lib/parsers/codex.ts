import type { NormalizedEvent, SessionAdapter } from "./schema";

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeInput(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function outputText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.flatMap((part) =>
      record(part) && (part.type === "text" || part.type === "output_text") &&
      typeof part.text === "string" ? [part.text] : [],
    ).join("\n");
  }
  return value === undefined ? "" : JSON.stringify(value);
}

/** Extract only apply_patch's success report; never infer writes from a command. */
function changedPaths(output: string): string[] {
  // CLI versions can wrap the report in {output, metadata}.
  const decoded: unknown = decodeInput(output);
  if (record(decoded) && record(decoded.metadata) &&
      typeof decoded.metadata.exit_code === "number" && decoded.metadata.exit_code !== 0) return [];
  const report = record(decoded) && typeof decoded.output === "string"
    ? decoded.output : output;
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

/**
 * Codex rollout JSONL → common events, in file order.
 * response_item is authoritative: event_msg mirrors are deliberately ignored.
 * Unknown records are ignored for forward compatibility. Invalid JSON throws a
 * line-only error so a corrupt upload cannot silently become a partial analysis.
 */
export const parseCodex: SessionAdapter = (lines) => {
  const events: NormalizedEvent[] = [];
  const calls = new Map<string, string>();

  for (const [index, line] of lines.entries()) {
    const trimmed = line.replace(/^\uFEFF/, "").trim();
    if (!trimmed) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid Codex JSON at line ${index + 1}`);
    }
    if (!record(entry) || entry.type !== "response_item" || !record(entry.payload)) continue;
    const item = entry.payload;
    const base = {
      ...(typeof entry.timestamp === "string" ? { ts: entry.timestamp } : {}),
      source: { tool: "codex", fidelity: "structured" } as const,
    };

    if (item.type === "message") {
      if (item.role !== "user" && item.role !== "assistant") continue;
      if (item.channel === "analysis" || item.phase === "analysis") continue;
      if (!Array.isArray(item.content)) continue;
      const text = item.content.flatMap((part) =>
        record(part) && (part.type === "input_text" || part.type === "output_text") &&
        typeof part.text === "string" ? [part.text] : [],
      ).join("\n");
      // Codex also injects repository and environment instructions as user items.
      if (item.role === "user" && /^(?:# AGENTS\.md instructions for |<environment_context>|<permissions instructions>|<INSTRUCTIONS>)/.test(text.trimStart())) continue;
      if (text) events.push({ ...base, role: item.role, text });
    } else if (item.type === "function_call" || item.type === "custom_tool_call") {
      const input = item.type === "function_call" ? item.arguments : item.input;
      if (typeof item.call_id !== "string" || typeof item.name !== "string" ||
          typeof input !== "string") continue;
      calls.set(item.call_id, item.name);
      events.push({
        ...base, role: "assistant", text: "",
        toolCalls: [{ id: item.call_id, name: item.name,
          input: item.type === "function_call" ? decodeInput(input) : input }],
      });
    } else if (item.type === "function_call_output" || item.type === "custom_tool_call_output") {
      if (typeof item.call_id !== "string") continue;
      const output = outputText(item.output);
      const name = calls.get(item.call_id);
      const files = name === "apply_patch" || name?.endsWith("__apply_patch") || name?.endsWith(".apply_patch")
        ? changedPaths(output) : [];
      events.push({
        ...base, role: "tool", text: "",
        toolResults: [{ callId: item.call_id, output }],
        ...(files.length ? { filesChanged: files } : {}),
      });
    }
  }
  return events;
};
