import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { STAGES, type PortfolioView } from "../src/lib/portfolio/view";

test("fixtures/portfolio.sample.json matches the PortfolioView contract", () => {
  const view: PortfolioView = JSON.parse(
    // 테스트는 .test-dist/tests/에서 실행되므로 __dirname이 아니라 cwd 기준.
    readFileSync(join(process.cwd(), "fixtures", "portfolio.sample.json"), "utf8"),
  );
  assert.equal(typeof view.slug, "string");
  assert.equal(typeof view.title, "string");
  assert.ok(Array.isArray(view.tools) && view.tools.length > 0);
  assert.ok(["structured", "transcript"].includes(view.fidelity));
  for (const stage of STAGES) assert.equal(typeof view.summary[stage], "string");
  assert.ok(view.timeline.length > 0);
  for (const t of view.timeline) {
    assert.ok(STAGES.includes(t.stage));
    assert.equal(typeof t.summary, "string");
    if (t.commit) {
      assert.equal(typeof t.commit.sha, "string");
      assert.match(t.commit.url, /\/commit\//);
    }
  }
  assert.ok(view.highlights.length >= 3 && view.highlights.length <= 5);
  for (const h of view.highlights) {
    assert.ok(STAGES.includes(h.stage));
    assert.ok(h.quote.length > 0 && h.why.length > 0);
  }
  for (const key of ["events", "toolCalls", "commits"] as const) {
    assert.equal(typeof view.stats[key], "number");
  }
});
