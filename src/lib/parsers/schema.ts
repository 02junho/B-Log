/** Shared contract: downstream analysis must not depend on rollout records. */
export interface ToolCall {
  id: string;
  name: string;
  /** JSON arguments when valid, otherwise the original text (including scripts). */
  input: unknown;
}

export interface ToolResult {
  callId: string;
  output: string;
}

export interface NormalizedEvent {
  role: "user" | "assistant" | "tool";
  ts?: string;
  text: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  /** Confirmed paths from a successful patch result, not proposed edits. */
  filesChanged?: string[];
  source: {
    tool: "claude-code" | "codex" | "generic";
    fidelity: "structured" | "transcript";
  };
}

export type SessionAdapter = (lines: readonly string[]) => NormalizedEvent[];
