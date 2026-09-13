import assert from "node:assert/strict";
import { test } from "node:test";
import { matchFindings, type MatchInput } from "../src/lib/match/stages";
import { parseRepoUrl, toRepoCommit, type RepoCommit } from "../src/lib/github/commits";
import { githubIdentityOf, isAuthoredBy } from "../src/lib/github/identity";
import { maskText } from "../src/lib/masking/rules";

const me = { id: "115946088", login: "JiwonKim-kr" };
const mine = (sha: string, authoredAt: string, extra: Partial<RepoCommit> = {}): RepoCommit => ({
  sha, message: `feat: ${sha}`, authoredAt, authorId: me.id, authorLogin: me.login, isMerge: false, ...extra,
});
const at = (hhmm: string) => `2026-09-10T${hhmm}:00Z`;
const finding = (findingId: string, hhmm?: string, chunkCommitShas: string[] = []): MatchInput => ({
  findingId, ...(hhmm ? { quoteTs: at(hhmm) } : {}), chunkCommitShas,
});

test("1단계: 로그 sha 접두사가 확정 연결되고 작성자를 따지지 않는다", () => {
  const teammate = mine("abc1234567890", at("10:00"), { authorId: "999", authorLogin: "someone" });
  const r = matchFindings([finding("f1", "12:01", ["abc1234"])], [teammate], { author: me });
  assert.deepEqual(r, [{ findingId: "f1", sha: "abc1234567890", method: "log", score: 1 }]);
});

test("2단계: 작업 직후 30분 안의 본인 커밋에 연결되고, 창 밖·시각 없음은 연결되지 않는다", () => {
  const r = matchFindings(
    [finding("near", "11:50"), finding("far", "08:00"), finding("no-ts")],
    [mine("def4567890123", at("12:00"))],
    { author: me },
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].findingId, "near");
  assert.equal(r[0].method, "time");
  assert.ok(r[0].score > 0.6 && r[0].score < 0.7, `score ${r[0].score}`);
});

test("2단계: 업로더를 모르면 추정 연결을 하지 않는다", () => {
  const r = matchFindings([finding("f", "11:55")], [mine("a1", at("12:00"))]);
  assert.deepEqual(r, []);
});

test("2단계: 팀원이 같은 시간대에 만든 커밋은 붙지 않는다", () => {
  const teammate = mine("t1", at("12:00"), { authorId: "161312300", authorLogin: "Aio1135" });
  assert.deepEqual(matchFindings([finding("f", "11:55")], [teammate], { author: me }), []);
});

test("회귀(9/13 E2E): 웹 UI 머지는 버튼을 누른 업로더가 작성자여도 붙지 않는다", () => {
  // 실제로 #19 머지 커밋의 GitHub author는 머지한 업로더 본인이었다.
  const merge = mine("0630e9a", at("12:00"), { message: "Merge pull request #19", isMerge: true });
  assert.deepEqual(matchFindings([finding("f", "11:58")], [merge], { author: me }), []);
});

test("2단계: 커밋 뒤에 나온 인용은 붙지 않는다 (시계 오차 2분만 허용)", () => {
  const c = mine("c1", at("12:00"));
  const r = matchFindings(
    [finding("after10", "12:10"), finding("skew", "12:01")],
    [c],
    { author: me },
  );
  assert.deepEqual(r.map((m) => m.findingId), ["skew"]);
});

test("회귀(9/13 E2E): 커밋 하나가 창 안의 finding 전부를 덮지 않는다", () => {
  const c = mine("c1", at("12:00"));
  const many = ["11:31", "11:40", "11:45", "11:50", "11:55", "11:59"].map((t, i) => finding(`f${i}`, t));
  const r = matchFindings(many, [c], { author: me });
  // 커밋에 가장 가까운 두 개만 남는다.
  assert.deepEqual(r.map((m) => m.findingId).sort(), ["f4", "f5"]);
  assert.equal(matchFindings(many, [c], { author: me, maxPerCommit: 1 })[0].findingId, "f5");
});

test("2단계: 1단계로 확정된 커밋에는 추정 연결을 더하지 않는다", () => {
  const c = mine("abc1234567890", at("12:00"));
  const r = matchFindings(
    [finding("exact", "11:59", ["abc1234"]), finding("guess", "11:58")],
    [c],
    { author: me },
  );
  assert.deepEqual(r.map((m) => [m.findingId, m.method]), [["exact", "log"]]);
});

test("2단계: 작성자를 확인할 수 없는 커밋(연결 안 된 이메일)은 붙지 않는다", () => {
  const unknown: RepoCommit = { sha: "u1", message: "x", authoredAt: at("12:00"), isMerge: false };
  assert.deepEqual(matchFindings([finding("f", "11:55")], [unknown], { author: me }), []);
});

test("GitHub 응답에서 작성자와 머지 여부를 읽는다", () => {
  const c = toRepoCommit({
    sha: "0630e9a",
    commit: { message: "Merge pull request #19\n\nbody", author: { date: at("12:00") } },
    author: { id: 115946088, login: "JiwonKim-kr" },
    parents: [{ sha: "a" }, { sha: "b" }],
  });
  assert.deepEqual(c, {
    sha: "0630e9a", message: "Merge pull request #19", authoredAt: at("12:00"),
    authorId: "115946088", authorLogin: "JiwonKim-kr", isMerge: true,
  });
  const orphan = toRepoCommit({ sha: "x", commit: { message: "m", author: null }, author: null, parents: [{ sha: "a" }] });
  assert.deepEqual(orphan, { sha: "x", message: "m", isMerge: false });
});

test("Supabase 사용자에서 GitHub 계정을 꺼낸다", () => {
  assert.deepEqual(
    githubIdentityOf({ identities: [{ provider: "github", identity_data: { provider_id: "115946088", user_name: "JiwonKim-kr" } }] }),
    me,
  );
  assert.deepEqual(githubIdentityOf({ user_metadata: { provider_id: 42, preferred_username: "octo" } }), { id: "42", login: "octo" });
  assert.equal(githubIdentityOf({ identities: [{ provider: "email", identity_data: {} }] }), undefined);
  assert.equal(githubIdentityOf(null), undefined);
});

test("작성자 대조는 id가 있으면 id로만 한다 (로그인명은 바뀔 수 있다)", () => {
  const c = mine("c", at("12:00"));
  assert.equal(isAuthoredBy(c, { id: "115946088", login: "renamed" }), true);
  assert.equal(isAuthoredBy(c, { id: "1", login: "JiwonKim-kr" }), false);
  assert.equal(isAuthoredBy({ sha: "s", message: "m", authorLogin: "JiwonKim-KR" }, { login: "jiwonkim-kr" }), true);
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
