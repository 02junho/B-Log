import assert from "node:assert/strict";
import { test } from "node:test";
import fixture from "./fixtures/tagging-golden.json";
import {
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
