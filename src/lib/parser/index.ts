import { parseClaudeCode } from "./adapters/claude-code";
import { parseCodex } from "./adapters/codex";
import { detectFormat } from "./detect";
import type { BLogSession, SessionAdapter, SourceTool } from "./schema";

export * from "./schema";
export { detectFormat } from "./detect";
export { sessionStats, type SessionStats } from "./stats";
export { parseClaudeCode } from "./adapters/claude-code";
export { parseCodex } from "./adapters/codex";

export const adapters: Partial<Record<SourceTool, SessionAdapter>> = {
  "claude-code": parseClaudeCode,
  codex: parseCodex,
};

/**
 * Single entry point for the pipeline: lines in, common schema out.
 * The transcript gate is LLM-structured and lives outside this synchronous
 * path, so an unrecognized file is reported rather than half-parsed.
 */
export function parseSession(lines: readonly string[], format?: SourceTool): BLogSession {
  const tool = format ?? detectFormat(lines);
  const adapter = adapters[tool];
  if (!adapter) {
    throw new Error(
      "Unrecognized log format. The transcript gate (LLM structuring) is not wired up yet.",
    );
  }
  return adapter(lines);
}
