import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCodex } from "../src/lib/parsers/codex";
import fixture from "./fixtures/codex-rollout.json";
import expected from "./fixtures/codex-normalized.json";

const lines = (items: unknown[]) => items.map((item) => JSON.stringify(item));
const response = (payload: unknown) => ({ type: "response_item", payload });
const call = (id: string, name = "exec_command", input = '{"cmd":"npm test"}') =>
  response({ type: "function_call", call_id: id, name, arguments: input });
const result = (id: string, output: unknown) =>
  response({ type: "function_call_output", call_id: id, output });

test("rollout fixture matches the complete common-schema snapshot", () => {
  const events = parseCodex(lines(fixture));
  assert.deepEqual(events, expected);
  assert.doesNotMatch(JSON.stringify(events), /SENTINEL/);
});

test("parallel tool results retain IDs and file order even when reversed", () => {
  const events = parseCodex(lines([
    call("a"), call("b"), result("b", "second"), result("a", "first"),
  ]));
  assert.deepEqual(events.slice(2).map((event) => event.toolResults?.[0]), [
    { callId: "b", output: "second" }, { callId: "a", output: "first" },
  ]);
});

test("unpaired calls and orphan results remain available without invented matches", () => {
  const events = parseCodex(lines([call("pending"), result("missing", "output")]));
  assert.equal(events[0].toolCalls?.[0].id, "pending");
  assert.deepEqual(events[1].toolResults, [{ callId: "missing", output: "output" }]);
  assert.equal(events[1].filesChanged, undefined);
});

test("invalid function arguments and custom scripts are preserved verbatim", () => {
  const events = parseCodex(lines([
    call("invalid", "shell", "{broken"),
    response({ type: "custom_tool_call", call_id: "js", name: "functions.exec",
      input: 'await tools.exec_command({cmd: "git commit -m fix"})' }),
  ]));
  assert.equal(events[0].toolCalls?.[0].input, "{broken");
  assert.equal(events[1].toolCalls?.[0].input, 'await tools.exec_command({cmd: "git commit -m fix"})');
});

test("failed or pending patches and unrelated output never claim changed files", () => {
  const events = parseCodex(lines([
    call("failed", "apply_patch", '"*** Update File: src/a.ts"'),
    result("failed", "Failed to find expected lines in src/a.ts"),
    call("pending", "apply_patch"),
    call("shell"), result("shell", "Success. Updated the following files:\nM fake.ts"),
  ]));
  assert.ok(events.every((event) => !event.filesChanged));
});

test("wrapped patch reports, spaces and duplicate paths are handled", () => {
  const events = parseCodex(lines([
    call("patch", "functions.apply_patch"),
    result("patch", JSON.stringify({ output: "Success. Updated the following files:\r\nM src/a b.ts\r\nM src/a b.ts\r\nA src/new.ts\r\n", metadata: { exit_code: 0 } })),
  ]));
  assert.deepEqual(events[1].filesChanged, ["src/a b.ts", "src/new.ts"]);
});

test("multimodal tool output keeps textual blocks only", () => {
  const events = parseCodex(lines([result("image", [
    { type: "text", text: "image summary" }, { type: "image", data: "BINARY_SENTINEL" },
  ])]));
  assert.deepEqual(events[0].toolResults, [{ callId: "image", output: "image summary" }]);
});

test("BOM, blank lines, absent timestamps and unknown records are supported", () => {
  const event = response({ type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] });
  assert.deepEqual(parseCodex(["", " \r", "\uFEFF" + JSON.stringify(event), "null", "[]", '{"type":"future"}']), [
    { role: "user", text: "hello", source: { tool: "codex", fidelity: "structured" } },
  ]);
});

test("broken JSON fails with a line number without echoing private input", () => {
  assert.throws(() => parseCodex(["", '{"PRIVATE_SENTINEL":']), {
    message: "Invalid Codex JSON at line 2",
  });
});

test("malformed recognized payloads are ignored safely", () => {
  assert.deepEqual(parseCodex(lines([
    response(null), response({ type: "message", role: "user", content: "bad" }),
    response({ type: "function_call", name: "shell", arguments: "{}" }),
    response({ type: "function_call_output", output: "orphan without ID" }),
  ])), []);
});

test("identical real user messages are not deduplicated", () => {
  const event = response({ type: "message", role: "user", content: [{ type: "input_text", text: "다시 해줘" }] });
  assert.equal(parseCodex(lines([event, event])).length, 2);
});

test("a nonzero patch exit code overrides success-looking output", () => {
  const events = parseCodex(lines([
    call("patch", "apply_patch"), result("patch", JSON.stringify({
      output: "Success. Updated the following files:\nM fake.ts", metadata: { exit_code: 1 },
    })),
  ]));
  assert.equal(events[1].filesChanged, undefined);
});

test("local rollout smoke check (opt-in; no raw content is printed or saved)", {
  skip: !process.env.BLOG_CODEX_LOG,
}, () => {
  const raw = readFileSync(process.env.BLOG_CODEX_LOG!, "utf8");
  const events = parseCodex(raw.split(/\r?\n/));
  assert.ok(events.length > 0);
  assert.ok(events.some((event) => event.role === "user"));
  assert.ok(events.some((event) => event.role === "assistant"));
  assert.ok(events.every((event) => event.source.tool === "codex" && event.source.fidelity === "structured"));
  assert.ok(events.some((event) => event.toolCalls?.length));
  const ids = new Set(events.flatMap((event) => event.toolCalls?.map((call) => call.id) ?? []));
  assert.ok(events.some((event) => event.toolResults?.some((result) => ids.has(result.callId))));
});
