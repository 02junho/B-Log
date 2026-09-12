import assert from "node:assert/strict";
import test from "node:test";
import sample from "../fixtures/portfolio.sample.json";
import {
  isPortfolioSlug,
  portfolioDisplaySchema,
  safeCommitUrl,
  displayTime,
  displayDuration,
} from "../src/lib/portfolio/presentation";

test("published Korean and Latin slugs are accepted, paths and invalid slugs rejected", () => {
  for (const slug of [
    "로그인-오류-수정-abc123",
    "sample-login-fix",
    "session-123456",
  ])
    assert.equal(isPortfolioSlug(slug), true);
  for (const slug of ["", "../private", "demo/id", "@missing", "a".repeat(161)])
    assert.equal(isPortfolioSlug(slug), false);
});

test("public display accepts the contract fixture and empty transcript sections", () => {
  assert.equal(portfolioDisplaySchema.safeParse(sample).success, true);
  assert.equal(
    portfolioDisplaySchema.safeParse({
      ...sample,
      fidelity: "transcript",
      timeline: [],
      highlights: [],
      stats: {
        ...sample.stats,
        durationMin: undefined,
        byRole: { user: 0, assistant: 0, tool: 0 },
      },
    }).success,
    true,
  );
});
test("malformed persisted portfolio data fails display validation", () => {
  assert.equal(
    portfolioDisplaySchema.safeParse({
      ...sample,
      timeline: [{ stage: "unknown" }],
    }).success,
    false,
  );
  assert.equal(
    portfolioDisplaySchema.safeParse({
      ...sample,
      stats: { ...sample.stats, events: -1 },
    }).success,
    false,
  );
  assert.equal(portfolioDisplaySchema.safeParse(null).success, false);
});
test("commit links reject scripts, lookalike hosts and credential URLs", () => {
  assert.equal(
    safeCommitUrl("https://github.com/demo/repo/commit/abc1234"),
    "https://github.com/demo/repo/commit/abc1234",
  );
  for (const url of [
    "",
    "javascript:alert(1)",
    "https://github.com.evil.test/demo/repo/commit/abc1234",
    "https://name:secret@github.com/demo/repo/commit/abc1234",
    "http://github.com/demo/repo/commit/abc1234",
    "https://github.com/demo/repo/issues/1",
  ])
    assert.equal(safeCommitUrl(url), undefined);
});
test("time and duration fallback labels are deterministic", () => {
  assert.equal(displayTime("2026-09-01T09:12:00Z"), "18:12");
  assert.equal(displayTime("bad date"), "시간 미기록");
  assert.equal(displayTime(), "시간 미기록");
  assert.equal(displayDuration(), "미기록");
  assert.equal(displayDuration(0), "0분");
  assert.equal(displayDuration(65), "1시간 5분");
});
