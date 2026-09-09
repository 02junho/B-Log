import assert from "node:assert/strict";
import { test } from "node:test";
import type { BLogSession } from "../src/lib/parser/schema";
import type { TaggedFinding } from "../src/lib/pipeline/tag";
import { buildPortfolioView, selectHighlights } from "../src/lib/portfolio/build";

const finding = (
  stage: TaggedFinding["stage"],
  confidence: number,
  eventId = "e0001",
  text = "인용",
): TaggedFinding => ({
  chunkId: "c001",
  stage,
  summary: `${stage} 요약(${confidence})`,
  quote: { eventId, text },
  confidence,
});

const session: BLogSession = {
  source: { tool: "claude-code", fidelity: "structured" },
  events: [
    {
      id: "e0001",
      role: "user",
      ts: "2026-09-09T01:00:00Z",
      text: "인용이 들어있는 사용자 발화",
    },
    {
      id: "e0002",
      role: "assistant",
      ts: "2026-09-09T01:10:00Z",
      text: "커밋했다",
      toolCalls: [{ id: "t1", name: "Bash", input: "git commit" }],
      gitCommit: { sha: "abc1234", message: "feat: x" },
    },
  ],
};

test("selectHighlights prefers stage diversity over raw confidence", () => {
  const picked = selectHighlights([
    finding("problem", 0.99),
    finding("problem", 0.98),
    finding("problem", 0.97),
    finding("problem", 0.96),
    finding("instruct", 0.5),
    finding("recovery", 0.4),
  ]);
  const stages = picked.map((f) => f.stage);
  assert.ok(stages.includes("instruct"));
  assert.ok(stages.includes("recovery"));
  assert.equal(picked.length, 5);
});

test("buildPortfolioView assembles summary, timeline, commit link, stats", () => {
  const view = buildPortfolioView(
    session,
    [finding("problem", 0.9), finding("evidence", 0.8, "e0002", "커밋했다")],
    { slug: "s", title: "T", repoUrl: "https://github.com/o/r.git" },
  );
  assert.equal(view.summary.problem, "problem 요약(0.9)");
  assert.equal(view.summary.recovery, "");
  assert.equal(view.timeline.length, 2);
  assert.equal(view.timeline[0].ts, "2026-09-09T01:00:00Z");
  assert.equal(
    view.timeline[1].commit?.url,
    "https://github.com/o/r/commit/abc1234",
  );
  assert.equal(view.tools[0], "Claude Code");
  assert.deepEqual(view.stats, {
    events: 2,
    toolCalls: 1,
    commits: 1,
    durationMin: 10,
  });
});
