import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCodex } from "../src/lib/parser/adapters/codex";
import fixture from "./fixtures/codex-rollout.json";
import expected from "./fixtures/codex-normalized.json";

const lines = (items: unknown[]) => items.map((item) => JSON.stringify(item));
const response = (payload: unknown) => ({ type: "response_item", payload });
const call = (id: string, name = "exec_command", input = '{"cmd":"npm test"}') =>
  response({ type: "function_call", call_id: id, name, arguments: input });
const result = (id: string, output: unknown) =>
  response({ type: "function_call_output", call_id: id, output });
const parse = (items: unknown[]) => parseCodex(lines(items)).events;

test("rollout fixture matches the complete common-schema snapshot", () => {
  const session = parseCodex(lines(fixture));
  assert.deepEqual(session, expected);
  assert.doesNotMatch(JSON.stringify(session), /SENTINEL/);
});

test("event ids are sequential and unique across the session", () => {
  const events = parse([
    response({ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }),
    call("a"),
    result("a", "done"),
  ]);
  assert.deepEqual(events.map((event) => event.id), ["e0001", "e0002", "e0003"]);
});

test("parallel tool results retain IDs and file order even when reversed", () => {
  const events = parse([call("a"), call("b"), result("b", "second"), result("a", "first")]);
  assert.deepEqual(events.slice(2).map((event) => event.toolResults?.[0]), [
    { callId: "b", output: "second" }, { callId: "a", output: "first" },
  ]);
});

test("unpaired calls and orphan results remain available without invented matches", () => {
  const events = parse([call("pending"), result("missing", "output")]);
  assert.equal(events[0].toolCalls?.[0].id, "pending");
  assert.deepEqual(events[1].toolResults, [{ callId: "missing", output: "output" }]);
  assert.equal(events[1].filesChanged, undefined);
});

test("invalid function arguments and custom scripts are preserved verbatim", () => {
  const events = parse([
    call("invalid", "shell", "{broken"),
    response({ type: "custom_tool_call", call_id: "js", name: "functions.exec",
      input: 'await tools.exec_command({cmd: "git commit -m fix"})' }),
  ]);
  assert.equal(events[0].toolCalls?.[0].input, "{broken");
  assert.equal(events[1].toolCalls?.[0].input, 'await tools.exec_command({cmd: "git commit -m fix"})');
});

test("failed or pending patches and unrelated output never claim changed files", () => {
  const events = parse([
    call("failed", "apply_patch", '"*** Update File: src/a.ts"'),
    result("failed", "Failed to find expected lines in src/a.ts"),
    call("pending", "apply_patch"),
    call("shell"), result("shell", "Success. Updated the following files:\nM fake.ts"),
  ]);
  assert.ok(events.every((event) => !event.filesChanged));
});

test("wrapped patch reports, spaces and duplicate paths are handled", () => {
  const events = parse([
    call("patch", "functions.apply_patch"),
    result("patch", JSON.stringify({ output: "Success. Updated the following files:\r\nM src/a b.ts\r\nM src/a b.ts\r\nA src/new.ts\r\n", metadata: { exit_code: 0 } })),
  ]);
  assert.deepEqual(events[1].filesChanged, ["src/a b.ts", "src/new.ts"]);
});

test("multimodal tool output keeps textual blocks only", () => {
  const events = parse([result("image", [
    { type: "text", text: "image summary" }, { type: "image", data: "BINARY_SENTINEL" },
  ])]);
  assert.deepEqual(events[0].toolResults, [{ callId: "image", output: "image summary" }]);
});

test("BOM, blank lines, absent timestamps and unknown records are supported", () => {
  const event = response({ type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] });
  assert.deepEqual(parseCodex(["", " \r", "\uFEFF" + JSON.stringify(event), "null", "[]", '{"type":"future"}']), {
    source: { tool: "codex", fidelity: "structured" },
    events: [{ id: "e0001", role: "user", text: "hello" }],
  });
});

test("broken JSON fails with a line number without echoing private input", () => {
  assert.throws(() => parseCodex(["", '{"PRIVATE_SENTINEL":']), {
    message: "Invalid Codex JSON at line 2",
  });
});

test("malformed recognized payloads are ignored safely", () => {
  assert.deepEqual(parse([
    response(null), response({ type: "message", role: "user", content: "bad" }),
    response({ type: "function_call", name: "shell", arguments: "{}" }),
    response({ type: "function_call_output", output: "orphan without ID" }),
  ]), []);
});

test("identical real user messages are not deduplicated", () => {
  const event = response({ type: "message", role: "user", content: [{ type: "input_text", text: "다시 해줘" }] });
  assert.equal(parse([event, event]).length, 2);
});

test("a nonzero patch exit code overrides success-looking output", () => {
  const events = parse([
    call("patch", "apply_patch"), result("patch", JSON.stringify({
      output: "Success. Updated the following files:\nM fake.ts", metadata: { exit_code: 1 },
    })),
  ]);
  assert.equal(events[1].filesChanged, undefined);
  assert.equal(events[1].toolResults?.[0].isError, true);
});

test("a nonzero shell exit is marked so recovery tagging can find it", () => {
  const events = parse([call("t"), result("t", "npm ERR! failed\nProcess exited with code 1")]);
  assert.equal(events[1].toolResults?.[0].isError, true);
});

test("a commit is recorded only when git confirms it with a sha", () => {
  const events = parse([
    call("ok", "exec_command", JSON.stringify({ cmd: `git commit -m "feat: 어댑터"` })),
    result("ok", "[main 1a2b3c4] feat: 어댑터\n 1 file changed"),
    call("rejected", "exec_command", JSON.stringify({ cmd: `git commit -m "feat: 거절"` })),
    result("rejected", "hook rejected the commit\nProcess exited with code 1"),
    call("log", "exec_command", JSON.stringify({ cmd: "git log --oneline -1" })),
    result("log", "9999999 earlier commit"),
  ]);
  assert.deepEqual(events[1].gitCommit, { sha: "1a2b3c4", message: "feat: 어댑터" });
  assert.equal(events[3].gitCommit, undefined);
  assert.equal(events[5].gitCommit, undefined);
});

test("a commit inside a wrapped script needs git's own report to count", () => {
  const script = (cmd: string) => `const r = await tools.exec_command({"cmd":"${cmd}"});`;
  const events = parse([
    response({ type: "custom_tool_call", call_id: "wrapped", name: "exec",
      input: script("git add -A && git commit -m 'feat: 중첩 스크립트'") }),
    result("wrapped", [{ type: "input_text", text: "Script completed\nOutput:\n[main 5d6e7f8] feat: 중첩 스크립트" }]),
    response({ type: "custom_tool_call", call_id: "read-only", name: "exec",
      input: script("git log --oneline -1") }),
    result("read-only", [{ type: "input_text", text: "5d6e7f8 feat: 중첩 스크립트" }]),
  ]);
  assert.deepEqual(events[1].gitCommit, { sha: "5d6e7f8", message: "feat: 중첩 스크립트" });
  assert.equal(events[1].toolResults?.[0].output.includes("[main 5d6e7f8]"), true);
  assert.equal(events[3].gitCommit, undefined);
});

test("session_meta supplies cwd and start time without becoming an event", () => {
  const session = parseCodex(lines([
    { type: "session_meta", timestamp: "2026-09-09T01:00:00Z", payload: { cwd: "/work", instructions: "SYSTEM_SENTINEL" } },
    response({ type: "message", role: "assistant", content: [{ type: "output_text", text: "시작합니다." }] }),
  ]));
  assert.equal(session.cwd, "/work");
  assert.equal(session.startedAt, "2026-09-09T01:00:00Z");
  assert.equal(session.events.length, 1);
  assert.doesNotMatch(JSON.stringify(session), /SENTINEL/);
});

test("local rollout smoke check (opt-in; no raw content is printed or saved)", {
  skip: !process.env.BLOG_CODEX_LOG,
}, () => {
  const raw = readFileSync(process.env.BLOG_CODEX_LOG!, "utf8");
  const session = parseCodex(raw.split(/\r?\n/));
  const events = session.events;
  assert.equal(session.source.tool, "codex");
  assert.equal(session.source.fidelity, "structured");
  assert.ok(events.length > 0);
  assert.ok(events.some((event) => event.role === "user"));
  assert.ok(events.some((event) => event.role === "assistant"));
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  assert.ok(events.some((event) => event.toolCalls?.length));
  const ids = new Set(events.flatMap((event) => event.toolCalls?.map((call) => call.id) ?? []));
  assert.ok(events.some((event) => event.toolResults?.some((result) => ids.has(result.callId))));
});
