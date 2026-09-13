/**
 * 커밋↔finding 매칭 1·2단계 (순수 함수 — 테스트 대상).
 * 3단계(임베딩)는 컷 1순위라 만들지 않는다 (TEAM_PLAN §6).
 *
 * 1단계 log: 로그 안에서 git이 확인해 준 커밋(짧은 sha)과 GitHub 커밋을
 *   sha 접두사로 잇고, 같은 청크의 findings에 연결한다. score 1.
 *   이 세션이 직접 만든 커밋이라는 증거가 로그에 있으므로 작성자를 따지지 않는다.
 *
 * 2단계 time: 1단계에 걸리지 않은 finding을, 그 직후 30분 안에 **업로더 본인이**
 *   만든 커밋에 연결한다. score = 1 - (커밋까지 걸린 시간)/30분.
 *   시간 창은 추정이라, 틀린 연결이 곧 "남의 결과를 내 것으로 주장"이 된다.
 *   그래서 아래를 모두 만족할 때만 연결한다 (9/13 E2E에서 오귀속 확인 후 강화):
 *   - 작성자가 업로더와 같다. 업로더를 모르면 2단계 자체를 하지 않는다.
 *     4인 팀 레포에서는 팀원 커밋이 같은 시간대에 반드시 섞인다.
 *   - 머지 커밋이 아니다. 웹 UI 머지는 버튼을 누른 사람이 작성자가 되므로
 *     작성자 대조로 걸러지지 않는다 — 실제로 E2E에서 남의 PR 머지가 붙었다.
 *   - 작업이 커밋보다 먼저다. 커밋은 과정의 결과이므로 인용이 커밋 뒤에 오면
 *     연결하지 않는다 (시계 오차 2분은 허용).
 *   - 1단계에서 이미 확정된 커밋이 아니다.
 *   - 커밋 하나에 가장 가까운 finding 몇 개만 붙인다. 창 안의 모든 finding에
 *     붙이면 커밋 하나가 타임라인 전체를 덮는다 (E2E에서 31개).
 */
import type { RepoCommit } from "../github/commits";
import { isAuthoredBy, type GitHubIdentity } from "../github/identity";

export interface MatchInput {
  findingId: string;
  /** 인용 이벤트의 시각 (없으면 2단계 불가). */
  quoteTs?: string;
  /** 이 finding이 속한 청크에 들어 있는, 로그가 확인한 커밋 sha들(짧아도 됨). */
  chunkCommitShas: string[];
}

export interface MatchResult {
  findingId: string;
  sha: string;
  method: "log" | "time";
  score: number;
}

export interface MatchOptions {
  /** 업로더의 GitHub 계정. 없으면 2단계(추정 연결)를 하지 않는다. */
  author?: GitHubIdentity;
  /** 커밋 하나에 추정으로 붙일 수 있는 finding 수. */
  maxPerCommit?: number;
}

const WINDOW_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;
const DEFAULT_MAX_PER_COMMIT = 2;

export function matchFindings(
  findings: readonly MatchInput[],
  commits: readonly RepoCommit[],
  options: MatchOptions = {},
): MatchResult[] {
  const results: MatchResult[] = [];
  const confirmedShas = new Set<string>();
  const unmatched: MatchInput[] = [];

  for (const f of findings) {
    // 1단계: 같은 청크의 로그 커밋 → sha 접두사로 GitHub 커밋 확정.
    const logMatch = f.chunkCommitShas
      .map((short) => commits.find((c) => c.sha.startsWith(short)))
      .find((c) => c !== undefined);
    if (logMatch) {
      results.push({ findingId: f.findingId, sha: logMatch.sha, method: "log", score: 1 });
      confirmedShas.add(logMatch.sha);
    } else {
      unmatched.push(f);
    }
  }

  const { author } = options;
  if (!author) return results;

  const eligible = commits.filter(
    (c) =>
      c.authoredAt !== undefined &&
      !Number.isNaN(Date.parse(c.authoredAt)) &&
      !c.isMerge &&
      !confirmedShas.has(c.sha) &&
      isAuthoredBy(c, author),
  );

  // 2단계: finding마다 그 뒤 30분 안의 가장 가까운 본인 커밋 하나.
  const candidates: MatchResult[] = [];
  for (const f of unmatched) {
    if (!f.quoteTs) continue;
    const t = Date.parse(f.quoteTs);
    if (Number.isNaN(t)) continue;
    let best: { sha: string; score: number } | undefined;
    for (const c of eligible) {
      const lead = Date.parse(c.authoredAt!) - t; // 양수 = 커밋이 인용보다 뒤
      if (lead < -CLOCK_SKEW_MS || lead > WINDOW_MS) continue;
      const score = 1 - Math.max(lead, 0) / WINDOW_MS;
      if (!best || score > best.score) best = { sha: c.sha, score };
    }
    if (best) {
      candidates.push({
        findingId: f.findingId,
        sha: best.sha,
        method: "time",
        score: Number(best.score.toFixed(3)),
      });
    }
  }

  // 커밋마다 가장 가까운 finding만 남긴다. 밀려난 finding은 다른 커밋으로
  // 옮기지 않는다 — 추정은 적게 주장하는 쪽이 안전하다.
  const max = options.maxPerCommit ?? DEFAULT_MAX_PER_COMMIT;
  const kept = new Set<MatchResult>();
  const bySha = new Map<string, MatchResult[]>();
  for (const c of candidates) bySha.set(c.sha, [...(bySha.get(c.sha) ?? []), c]);
  for (const group of bySha.values()) {
    for (const c of [...group].sort((a, b) => b.score - a.score).slice(0, max)) kept.add(c);
  }

  return [...results, ...candidates.filter((c) => kept.has(c))];
}
