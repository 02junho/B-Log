/**
 * B-Log common session schema (TEAM_PLAN §3.1).
 *
 * Every input gate — Claude Code, Codex, generic transcript — is normalized to
 * this shape, and the analysis pipeline reads nothing else. Adapters may not
 * leak tool-specific record types past this boundary.
 */

export type EventRole = "user" | "assistant" | "tool";

/** Which gate produced the session, and how much detail survived. */
export type SourceTool = "claude-code" | "codex" | "transcript";
export type Fidelity = "structured" | "transcript";

export interface ToolCall {
  /** Adapter-preserved call id; pairs with ToolResult.callId. */
  id: string;
  name: string;
  /** JSON arguments when valid, otherwise the original text (including scripts). */
  input: unknown;
}

export interface ToolResult {
  callId: string;
  output: string;
  /** Set when the tool reported failure — the entry point for recovery tagging. */
  isError?: boolean;
}

/** A commit observed inside the log itself: matching stage ① (TEAM_PLAN §3.2). */
export interface GitCommitRef {
  sha?: string;
  message: string;
}

export interface BLogEvent {
  /** Session-local sequence id, assigned by the adapter. */
  id: string;
  role: EventRole;
  /** ISO timestamp. Transcript-grade sessions may have none. */
  ts?: string;
  text: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  /** Confirmed paths from a successful write, not proposed edits. */
  filesChanged?: string[];
  gitCommit?: GitCommitRef;
}

export interface BLogSession {
  source: { tool: SourceTool; fidelity: Fidelity };
  cwd?: string;
  startedAt?: string;
  events: BLogEvent[];
}

/** The whole adapter interface: lines in, one normalized session out. */
export type SessionAdapter = (lines: readonly string[]) => BLogSession;

/** Stable event ids so findings and matches can reference them across runs. */
export function eventId(index: number): string {
  return `e${String(index + 1).padStart(4, "0")}`;
}
