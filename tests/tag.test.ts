import assert from "node:assert/strict";
import { test } from "node:test";
import type { Chunk } from "../src/lib/pipeline/chunk";
import {
  mapWithConcurrency,
  tagChunk,
  tagSession,
  type ChunkRunner,
} from "../src/lib/pipeline/tag";

const chunk = (id: string, text: string, eventIds: string[]): Chunk => ({
  id,
  eventIds,
  text,
});

test("mapWithConcurrency preserves order and respects the limit", async () => {
  let running = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    return n * 10;
  });
  assert.deepEqual(result, [10, 20, 30, 40, 50, 60]);
  assert.ok(peak <= 2, `peak concurrency ${peak} > 2`);
});

test("tagChunk keeps only verbatim quotes from known events", async () => {
  const c = chunk("c001", "[e0001] user: 로그인 버그를 고쳐줘", ["e0001"]);
  const runner: ChunkRunner = async () => ({
    output: {
      findings: [
        {
          stage: "problem",
          summary: "버그 수정 요청",
          quote: { eventId: "e0001", text: "로그인 버그를 고쳐줘" },
          confidence: 0.9,
        },
        {
          stage: "evidence",
          summary: "원문에 없는 인용",
          quote: { eventId: "e0001", text: "존재하지 않는 문장" },
          confidence: 0.8,
        },
        {
          stage: "recovery",
          summary: "다른 청크의 이벤트",
          quote: { eventId: "e0099", text: "로그인 버그를 고쳐줘" },
          confidence: 0.8,
        },
      ],
    },
    inputTokens: 100,
    outputTokens: 50,
  });
  const r = await tagChunk(c, runner);
  assert.equal(r.ok, true);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].chunkId, "c001");
  assert.equal(r.droppedQuotes, 2);
});

test("tagChunk retries once and then reports failure", async () => {
  let calls = 0;
  const failing: ChunkRunner = async () => {
    calls++;
    throw new Error("boom");
  };
  const r = await tagChunk(chunk("c001", "x", []), failing);
  assert.equal(calls, 2);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /boom/);
});

test("tagSession aggregates findings, failures, and usage", async () => {
  const chunks = [
    chunk("c001", "[e0001] user: A", ["e0001"]),
    chunk("c002", "[e0002] user: B", ["e0002"]),
  ];
  const runner: ChunkRunner = async (c) => {
    if (c.id === "c002") throw new Error("down");
    return {
      output: {
        findings: [
          {
            stage: "instruct",
            summary: "지시",
            quote: { eventId: "e0001", text: "A" },
            confidence: 0.7,
          },
        ],
      },
      inputTokens: 10,
      outputTokens: 5,
    };
  };
  const r = await tagSession(chunks, { runner, concurrency: 2 });
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.failedChunks, ["c002"]);
  assert.equal(r.inputTokens, 10);
  assert.equal(r.outputTokens, 5);
});
