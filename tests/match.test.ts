import assert from "node:assert/strict";
import { test } from "node:test";
import { matchFindings } from "../src/lib/match/stages";
import { parseRepoUrl } from "../src/lib/github/commits";
import { maskText } from "../src/lib/masking/rules";

const commits = [
  { sha: "abc1234567890", message: "fix: a", authoredAt: "2026-09-10T10:00:00Z" },
  { sha: "def4567890123", message: "feat: b", authoredAt: "2026-09-10T12:00:00Z" },
];

test("stage 1: log sha prefix wins with score 1", () => {
  const r = matchFindings(
    [{ findingId: "f1", quoteTs: "2026-09-10T12:01:00Z", chunkCommitShas: ["abc1234"] }],
    commits,
  );
  assert.deepEqual(r, [{ findingId: "f1", sha: "abc1234567890", method: "log", score: 1 }]);
});

test("stage 2: nearest commit within ±30min, none outside", () => {
  const r = matchFindings(
    [
      { findingId: "near", quoteTs: "2026-09-10T12:10:00Z", chunkCommitShas: [] },
      { findingId: "far", quoteTs: "2026-09-10T20:00:00Z", chunkCommitShas: [] },
      { findingId: "no-ts", chunkCommitShas: [] },
    ],
    commits,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].findingId, "near");
  assert.equal(r[0].method, "time");
  assert.equal(r[0].sha, "def4567890123");
  assert.ok(r[0].score > 0.6 && r[0].score < 0.7);
});

test("parseRepoUrl handles .git and trailing slash", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/o/r.git"), { owner: "o", repo: "r" });
  assert.deepEqual(parseRepoUrl("https://github.com/o/r/"), { owner: "o", repo: "r" });
  assert.equal(parseRepoUrl("https://gitlab.com/o/r"), null);
});

test("masking replaces secrets but keeps surrounding text", () => {
  const masked = maskText(
    "메일 a@b.co, 키 sk-abcdef123456789, 경로 /Users/junho/Blog, 폰 010-1234-5678",
  );
  assert.equal(
    masked,
    "메일 [이메일], 키 [API키], 경로 /Users/[사용자]/Blog, 폰 [전화번호]",
  );
});
