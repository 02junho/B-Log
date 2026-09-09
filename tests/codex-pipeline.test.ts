import assert from "node:assert/strict";
import test from "node:test";
import { parseSession } from "../src/lib/parser";
import { chunkSession } from "../src/lib/pipeline/chunk";
import { tagSession, type ChunkRunner } from "../src/lib/pipeline/tag";
import { buildPortfolioView } from "../src/lib/portfolio/build";
import fixture from "./fixtures/codex-rollout.json";

const session = () => parseSession(fixture.map((record) => JSON.stringify(record)));
const meta = { slug: "codex-demo", title: "Codex 통합 검증", repoUrl: "https://github.com/demo/project" };

test("Codex rollout passes through detection, chunks, verified tagging and portfolio", async () => {
  const parsed = session();
  const chunks = chunkSession(parsed);
  assert.equal(parsed.source.tool, "codex");
  assert.deepEqual(chunks.flatMap((chunk) => chunk.eventIds), parsed.events.map((event) => event.id));
  const runner: ChunkRunner = async () => ({
    output: { findings: [
      { stage: "problem", summary: "버그 수정 요청", quote: { eventId: "e0001", text: "버그를 고쳐줘." }, confidence: 0.9 },
      { stage: "evidence", summary: "수정 커밋", quote: { eventId: "e0004", text: "fix: 예외 처리" }, confidence: 0.9 },
      { stage: "recovery", summary: "환각 인용", quote: { eventId: "e0001", text: "없는 문장" }, confidence: 0.9 },
    ] }, inputTokens: 10, outputTokens: 5,
  });
  const tagged = await tagSession(chunks, { runner });
  const view = buildPortfolioView(parsed, tagged.findings, meta);
  assert.deepEqual(tagged.failedChunks, []);
  assert.equal(tagged.results.reduce((sum, result) => sum + result.droppedQuotes, 0), 1);
  assert.equal(view.fidelity, "structured");
  assert.ok(view.tools.includes("OpenAI Codex"));
  assert.equal(view.stats.events, 7);
  assert.equal(view.stats.toolCalls, 2);
  assert.equal(view.stats.commits, 1);
  assert.deepEqual(view.stats.byRole, { user: 1, assistant: 4, tool: 2 });
  assert.equal(view.timeline[0].quote, "버그를 고쳐줘.");
  assert.equal(view.timeline[1].commit?.url, "https://github.com/demo/project/commit/abc1234");
  assert.equal(view.highlights.length, 2);
  assert.doesNotMatch(JSON.stringify(view), /없는 문장|SENTINEL/);
});

test("a quote from another event in the same Codex chunk never reaches the portfolio", async () => {
  const parsed = session();
  const runner: ChunkRunner = async () => ({ output: { findings: [
    { stage: "instruct", summary: "AI 발화를 사용자 지시로 오인", quote: { eventId: "e0001", text: "원인을 확인하겠습니다." }, confidence: 1 },
    { stage: "problem", summary: "빈 인용", quote: { eventId: "e0001", text: "" }, confidence: 1 },
  ] }, inputTokens: 1, outputTokens: 1 });
  const tagged = await tagSession(chunkSession(parsed), { runner });
  const view = buildPortfolioView(parsed, tagged.findings, meta);
  assert.equal(tagged.results[0].droppedQuotes, 2);
  assert.deepEqual(view.timeline, []);
  assert.deepEqual(view.highlights, []);
  assert.equal(view.summary.instruct, "");
});

test("failed Codex tagging retries and does not produce fabricated portfolio findings", async () => {
  let calls = 0;
  const parsed = session();
  const tagged = await tagSession(chunkSession(parsed), { runner: async () => {
    calls++;
    throw new Error("synthetic outage");
  } });
  assert.equal(calls, 2);
  assert.deepEqual(tagged.failedChunks, ["c001"]);
  const view = buildPortfolioView(parsed, tagged.findings, meta);
  assert.deepEqual(view.timeline, []);
  assert.equal(view.stats.commits, 1);
});
