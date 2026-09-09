import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseClaudeCode } from "../src/lib/parser/adapters/claude-code";
import fixture from "./fixtures/claude-code-session.json";
import expected from "./fixtures/claude-code-normalized.json";

const lines = (items: unknown[]) => items.map((item) => JSON.stringify(item));
const parse = (items: unknown[]) => parseClaudeCode(lines(items)).events;
const user = (content: unknown, extra: object = {}) => ({
  type: "user", uuid: "u", sessionId: "s", message: { role: "user", content }, ...extra,
});
const assistant = (content: unknown, extra: object = {}) => ({
  type: "assistant", uuid: "a", sessionId: "s", message: { role: "assistant", content }, ...extra,
});
const use = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const gotResult = (id: string, content: unknown, detail?: unknown, isError = false) =>
  user([{ type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }],
    detail === undefined ? {} : { toolUseResult: detail });

test("session fixture matches the complete common-schema snapshot", () => {
  const session = parseClaudeCode(lines(fixture));
  assert.deepEqual(session, expected);
  assert.doesNotMatch(JSON.stringify(session), /SENTINEL/);
});

test("host bookkeeping records never become conversation events", () => {
  assert.deepEqual(parse([
    { type: "attachment", attachment: { content: "x" }, uuid: "1", sessionId: "s" },
    { type: "system", subtype: "stop_hook_summary", content: "x", sessionId: "s" },
    { type: "queue-operation", operation: "add", content: "x", sessionId: "s" },
    { type: "custom-title", customTitle: "x", sessionId: "s" },
    { type: "future-record-type", sessionId: "s" },
  ]), []);
});

test("slash-command echoes, meta records and sidechains are excluded", () => {
  assert.deepEqual(parse([
    user("<command-name>/compact</command-name>\n<command-args></command-args>"),
    user("<local-command-stdout>Compacted </local-command-stdout>"),
    user("<task-notification>\n<task-id>b1</task-id>\n</task-notification>"),
    user("real question", { isMeta: true }),
    assistant([{ type: "text", text: "subagent turn" }], { isSidechain: true }),
  ]), []);
});

test("system reminders are stripped but the user's own words survive", () => {
  const events = parse([
    user([{ type: "text", text: "<system-reminder>ignore me</system-reminder>정말 필요한 질문" }]),
    user("<system-reminder>only a reminder</system-reminder>"),
  ]);
  assert.deepEqual(events.map((event) => event.text), ["정말 필요한 질문"]);
});

test("thinking blocks and images are dropped while text is kept in order", () => {
  const events = parse([
    assistant([
      { type: "thinking", thinking: "private draft" },
      { type: "text", text: "첫 줄" },
      { type: "text", text: "둘째 줄" },
    ]),
    user([{ type: "image", source: { data: "binary" } }, { type: "text", text: "이 화면입니다" }]),
  ]);
  assert.deepEqual(events.map((event) => event.text), ["첫 줄\n둘째 줄", "이 화면입니다"]);
});

test("a message carrying both text and tool calls keeps them on one event", () => {
  const events = parse([
    assistant([
      { type: "text", text: "두 파일을 함께 읽겠습니다." },
      use("c1", "Read", { file_path: "/a.ts" }),
      use("c2", "Read", { file_path: "/b.ts" }),
    ]),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].role, "assistant");
  assert.equal(events[0].text, "두 파일을 함께 읽겠습니다.");
  assert.deepEqual(events[0].toolCalls?.map((call) => call.id), ["c1", "c2"]);
});

test("tool results become tool events paired by the call id", () => {
  const events = parse([
    assistant([use("c1", "Read", { file_path: "/a.ts" })]),
    gotResult("c1", [{ type: "text", text: "file body" }]),
  ]);
  assert.equal(events[1].role, "tool");
  assert.deepEqual(events[1].toolResults, [{ callId: "c1", output: "file body" }]);
});

test("only write tools report changed files, and only when they succeeded", () => {
  const events = parse([
    assistant([use("edit", "Edit", { file_path: "/demo/a.ts" })]),
    gotResult("edit", "updated", { filePath: "/demo/a.ts", structuredPatch: [] }),
    assistant([use("read", "Read", { file_path: "/demo/b.ts" })]),
    gotResult("read", "body", { type: "text", file: { filePath: "/demo/b.ts" } }),
    assistant([use("failed", "Write", { file_path: "/demo/c.ts" })]),
    gotResult("failed", "permission denied", { filePath: "/demo/c.ts" }, true),
  ]);
  assert.deepEqual(events[1].filesChanged, ["/demo/a.ts"]);
  assert.equal(events[3].filesChanged, undefined);
  assert.equal(events[5].filesChanged, undefined);
  assert.equal(events[5].toolResults?.[0].isError, true);
});

test("a commit is recorded from git's own confirmation, not from the command", () => {
  const events = parse([
    assistant([use("ok", "Bash", { command: 'git commit -m "feat: 어댑터"' })]),
    gotResult("ok", "[main 1a2b3c4] feat: 어댑터", {
      stdout: "[main 1a2b3c4] feat: 어댑터", gitOperation: { commit: { sha: "1a2b3c4" } },
    }),
    assistant([use("rejected", "Bash", { command: 'git commit -m "feat: 거절"' })]),
    gotResult("rejected", "hook rejected the commit", { stdout: "", stderr: "rejected" }, true),
    assistant([use("nothing", "Bash", { command: "git commit -m 'nothing staged'" })]),
    gotResult("nothing", "nothing to commit", { stdout: "nothing to commit", stderr: "" }),
    assistant([use("grep", "Bash", { command: "git log --grep=commit -1 --oneline" })]),
    gotResult("grep", "9999999 an older commit", { stdout: "9999999 an older commit" }),
  ]);
  assert.deepEqual(events[1].gitCommit, { sha: "1a2b3c4", message: "feat: 어댑터" });
  assert.equal(events[3].gitCommit, undefined);
  assert.equal(events[5].gitCommit, undefined);
  assert.equal(events[7].gitCommit, undefined);
});

test("the commit message comes from the commit, not from an earlier command", () => {
  const events = parse([
    assistant([use("chain", "Bash", {
      command: `grep -m 1 TODO src/a.ts && git commit -m "fix: 실제 메시지"`,
    })]),
    gotResult("chain", "[main 2b3c4d5] fix: 실제 메시지", {
      stdout: "[main 2b3c4d5] fix: 실제 메시지", gitOperation: { commit: { sha: "2b3c4d5" } },
    }),
  ]);
  assert.deepEqual(events[1].gitCommit, { sha: "2b3c4d5", message: "fix: 실제 메시지" });
});

test("a message with escaped quotes survives shell unescaping", () => {
  const events = parse([
    assistant([use("q", "Bash", { command: `git commit -m "fix: \\"인용\\" 처리"` })]),
    gotResult("q", "[main 3c4d5e6] done", { stdout: "[main 3c4d5e6] done", gitOperation: { commit: { sha: "3c4d5e6" } } }),
  ]);
  assert.equal(events[1].gitCommit?.message, 'fix: "인용" 처리');
});

test("a record with several results claims neither files nor commits", () => {
  const events = parse([
    assistant([use("c1", "Edit", { file_path: "/a.ts" }), use("c2", "Edit", { file_path: "/b.ts" })]),
    user([
      { type: "tool_result", tool_use_id: "c1", content: "ok" },
      { type: "tool_result", tool_use_id: "c2", content: "ok" },
    ], { toolUseResult: { filePath: "/a.ts" } }),
  ]);
  assert.equal(events[1].toolResults?.length, 2);
  assert.equal(events[1].filesChanged, undefined);
});

test("BOM, blank lines and malformed messages are tolerated", () => {
  const line = JSON.stringify(user("hello"));
  assert.deepEqual(parseClaudeCode(["", " \r", "\uFEFF" + line, "null", "[]", '{"type":"user"}']), {
    source: { tool: "claude-code", fidelity: "structured" },
    events: [{ id: "e0001", role: "user", text: "hello" }],
  });
});

test("broken JSON fails with a line number without echoing private input", () => {
  assert.throws(() => parseClaudeCode(["", '{"PRIVATE_SENTINEL":']), {
    message: "Invalid Claude Code JSON at line 2",
  });
});

test("local session smoke check (opt-in; no raw content is printed or saved)", {
  skip: !process.env.BLOG_CLAUDE_LOG,
}, () => {
  const raw = readFileSync(process.env.BLOG_CLAUDE_LOG!, "utf8");
  const session = parseClaudeCode(raw.split(/\r?\n/));
  const events = session.events;
  assert.equal(session.source.tool, "claude-code");
  assert.ok(events.length > 0);
  assert.ok(events.some((event) => event.role === "user"));
  assert.ok(events.some((event) => event.role === "assistant"));
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  assert.ok(events.some((event) => event.toolCalls?.length));
  // No injected block survives. A bare tag can be real content — this repo's
  // own sessions discuss it — so only well-formed pairs count, and every
  // assertion here stays boolean so a failure never prints the session.
  const reminder = /<system-reminder>[\s\S]*?<\/system-reminder>/;
  assert.equal(events.some((event) => reminder.test(event.text)), false);
  assert.equal(
    events.some((event) => event.toolResults?.some((result) => reminder.test(result.output))),
    false,
  );
  const ids = new Set(events.flatMap((event) => event.toolCalls?.map((call) => call.id) ?? []));
  assert.ok(events.some((event) => event.toolResults?.some((result) => ids.has(result.callId))));
});
