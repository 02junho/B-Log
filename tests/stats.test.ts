import assert from "node:assert/strict";
import test from "node:test";
import { parseClaudeCode, parseCodex, sessionStats } from "../src/lib/parser";
import claudeFixture from "./fixtures/claude-code-session.json";
import codexFixture from "./fixtures/codex-rollout.json";
import type { BLogSession } from "../src/lib/parser";

const lines = (items: unknown[]) => items.map((item) => JSON.stringify(item));
const session = (events: BLogSession["events"]): BLogSession => ({
  source: { tool: "claude-code", fidelity: "structured" },
  events,
});

test("fixture sessions produce the stats the portfolio page needs", () => {
  assert.deepEqual(sessionStats(parseClaudeCode(lines(claudeFixture))), {
    events: 12,
    byRole: { user: 2, assistant: 6, tool: 4 },
    toolCalls: 4,
    toolErrors: 1,
    commits: 1,
    filesChanged: 1,
    tools: ["Bash", "Edit", "Read"],
    durationMin: 0,
  });
  const codex = sessionStats(parseCodex(lines(codexFixture)));
  assert.equal(codex.commits, 1);
  assert.equal(codex.filesChanged, 3);
  assert.deepEqual(codex.tools, ["apply_patch", "exec_command"]);
});

test("duplicate files count once and tool names are de-duplicated", () => {
  const stats = sessionStats(session([
    { id: "e0001", role: "assistant", text: "", toolCalls: [{ id: "a", name: "Edit", input: {} }] },
    { id: "e0002", role: "tool", text: "", filesChanged: ["/a.ts"] },
    { id: "e0003", role: "assistant", text: "", toolCalls: [{ id: "b", name: "Edit", input: {} }] },
    { id: "e0004", role: "tool", text: "", filesChanged: ["/a.ts", "/b.ts"] },
  ]));
  assert.deepEqual(stats.tools, ["Edit"]);
  assert.equal(stats.toolCalls, 2);
  assert.equal(stats.filesChanged, 2);
});

test("duration is omitted when no event is timestamped", () => {
  assert.equal(sessionStats(session([{ id: "e0001", role: "user", text: "hi" }])).durationMin, undefined);
  assert.equal(sessionStats(session([])).events, 0);
});

test("duration spans the session and survives an unparseable timestamp", () => {
  const stats = sessionStats(session([
    { id: "e0001", role: "user", ts: "2026-09-09T00:00:00Z", text: "start" },
    { id: "e0002", role: "assistant", ts: "not a date", text: "middle" },
    { id: "e0003", role: "assistant", ts: "2026-09-09T01:30:00Z", text: "end" },
  ]));
  assert.equal(stats.durationMin, 90);
});
