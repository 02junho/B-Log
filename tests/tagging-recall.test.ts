import assert from "node:assert/strict";
import { test } from "node:test";
import fixture from "./fixtures/tagging-golden.json";
import {
  scoreInstructUserRecall,
  scoreTaggingCases,
  type TaggingGoldenCase,
} from "../scripts/eval/tagging-recall";
import { STAGES } from "../src/lib/prompts/tagging";

const cases = fixture as TaggingGoldenCase[];

test("tagging golden fixture has at least ten unique, stage-labelled user requests", () => {
  assert.ok(cases.length >= 10);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  assert.equal(new Set(cases.map((item) => item.eventId)).size, cases.length);
  for (const item of cases) {
    assert.match(item.eventId, /^e\d{4}$/);
    assert.ok(item.text.length >= 3);
    assert.ok(item.expectedStages.length >= 1);
    assert.ok(item.expectedStages.every((stage) => STAGES.includes(stage)));
  }
  for (const stage of STAGES) {
    assert.ok(cases.some((item) => item.expectedStages.includes(stage)));
  }
  assert.ok(cases.some((item) => item.expectedStages.length > 1));

  const instructKinds = new Set(
    cases.flatMap((item) => (item.instructKind ? [item.instructKind] : [])),
  );
  assert.deepEqual(instructKinds, new Set(["short-command", "constraint", "continuation"]));
  for (const kind of instructKinds) {
    assert.ok(
      cases.filter((item) => item.instructKind === kind).length >= 2,
      `${kind} fixture가 두 건 이상이어야 합니다.`,
    );
  }
});

test("stage scoring measures case-level recall instead of raw finding counts", () => {
  const sample = cases.slice(0, 4);
  const score = scoreTaggingCases(sample, [
    { id: sample[0].id, predictedStages: ["problem", "problem"] },
    { id: sample[1].id, predictedStages: [] },
    { id: sample[2].id, predictedStages: ["problem"] },
    { id: sample[3].id, predictedStages: ["problem", "instruct"] },
  ]);

  assert.deepEqual(score.perStage.problem, {
    expected: 4,
    predicted: 3,
    hits: 3,
    precision: 1,
    recall: 0.75,
  });
  assert.deepEqual(score.perStage.instruct, {
    expected: 2,
    predicted: 1,
    hits: 1,
    precision: 1,
    recall: 0.5,
  });
  assert.equal(score.exactMatches, 2);
  assert.equal(score.exactMatchRate, 0.5);
});

test("instruct recall checks every user utterance and reports misses and false positives", () => {
  const sample: TaggingGoldenCase[] = [
    {
      id: "short",
      eventId: "e0201",
      text: "리뷰 진행해.",
      expectedStages: ["instruct"],
      instructKind: "short-command",
    },
    {
      id: "constraint",
      eventId: "e0202",
      text: "머지는 시도하지 마.",
      expectedStages: ["instruct"],
      instructKind: "constraint",
    },
    {
      id: "continuation",
      eventId: "e0203",
      text: "그대로 해.",
      expectedStages: ["instruct"],
      instructKind: "continuation",
    },
    {
      id: "evidence",
      eventId: "e0204",
      text: "테스트 3개가 통과했다.",
      expectedStages: ["evidence"],
    },
  ];

  const score = scoreInstructUserRecall(sample, [
    { id: "short", predictedStages: ["instruct"] },
    { id: "constraint", predictedStages: [] },
    { id: "evidence", predictedStages: ["instruct"] },
  ]);

  assert.deepEqual(score, {
    userUtterances: 4,
    expected: 3,
    predicted: 2,
    hits: 1,
    precision: 0.5,
    recall: 1 / 3,
    missedIds: ["constraint", "continuation"],
    falsePositiveIds: ["evidence"],
    perKind: {
      "short-command": { expected: 1, hits: 1, recall: 1 },
      constraint: { expected: 1, hits: 0, recall: 0 },
      continuation: { expected: 1, hits: 0, recall: 0 },
    },
  });
});
