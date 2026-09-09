import assert from "node:assert/strict";
import test from "node:test";
import { detectFormat, parseSession } from "../src/lib/parser";
import claudeFixture from "./fixtures/claude-code-session.json";
import codexFixture from "./fixtures/codex-rollout.json";

const lines = (items: unknown[]) => items.map((item) => JSON.stringify(item));

test("both structured fixtures are recognized by their own gate", () => {
  assert.equal(detectFormat(lines(claudeFixture)), "claude-code");
  assert.equal(detectFormat(lines(codexFixture)), "codex");
});

test("detection does not depend on the first line being a conversation record", () => {
  assert.equal(detectFormat(lines([
    { type: "queue-operation", operation: "add", sessionId: "s" },
    { type: "user", uuid: "u", sessionId: "s", message: { role: "user", content: "hi" } },
  ])), "claude-code");
  assert.equal(detectFormat(lines([
    { type: "turn_context", payload: {} },
    { type: "response_item", payload: { type: "message", role: "user", content: [] } },
  ])), "codex");
});

test("prose, markdown and empty input fall through to the transcript gate", () => {
  assert.equal(detectFormat(["# 세션 기록", "", "나: 버그를 고쳐줘", "AI: 확인하겠습니다"]), "transcript");
  assert.equal(detectFormat([]), "transcript");
  assert.equal(detectFormat(['{"type":"something-else"}', '{"no":"type"}']), "transcript");
});

test("parseSession routes to the adapter and keeps the source tag", () => {
  assert.equal(parseSession(lines(claudeFixture)).source.tool, "claude-code");
  assert.equal(parseSession(lines(codexFixture)).source.tool, "codex");
});

test("a forced format overrides detection", () => {
  const session = parseSession(lines(codexFixture), "codex");
  assert.equal(session.source.tool, "codex");
  assert.ok(session.events.length > 0);
});

test("the transcript gate reports that it is not wired up instead of half-parsing", () => {
  assert.throws(() => parseSession(["나: 안녕", "AI: 안녕하세요"]), /transcript gate/);
});
