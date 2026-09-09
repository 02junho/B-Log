import assert from "node:assert/strict";
import test from "node:test";
import { chunkSession } from "../src/lib/pipeline/chunk";
import { eventId, type BLogSession } from "../src/lib/parser/schema";

test("a short preceding turn cannot bypass splitting of a long turn", () => {
  const session: BLogSession = {
    source: { tool: "codex", fidelity: "structured" },
    events: [
      { id: "e0001", role: "user", text: "짧은 요청" },
      { id: "e0002", role: "user", text: "긴 작업 요청" },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: eventId(index + 2), role: "assistant" as const, text: "가".repeat(2400),
      })),
    ],
  };
  const chunks = chunkSession(session);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 9000));
  assert.deepEqual(chunks.flatMap((chunk) => chunk.eventIds), session.events.map((event) => event.id));
});

test("empty sessions do not create chunks", () => {
  assert.deepEqual(chunkSession({ source: { tool: "codex", fidelity: "structured" }, events: [] }), []);
});
