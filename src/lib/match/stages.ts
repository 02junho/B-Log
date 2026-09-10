/**
 * 커밋↔finding 매칭 1·2단계 (순수 함수 — 테스트 대상).
 * 3단계(임베딩)는 컷 1순위라 만들지 않는다 (TEAM_PLAN §6).
 *
 * 1단계 log: 로그 안에서 git이 확인해 준 커밋(짧은 sha)과 GitHub 커밋을
 *   sha 접두사로 잇고, 같은 청크의 findings에 연결한다. score 1.
 * 2단계 time: 1단계에 걸리지 않은 finding의 인용 이벤트 시각과
 *   커밋 authoredAt이 ±30분 안이면 연결. score = 1 - |Δt|/30분.
 */
import type { RepoCommit } from "../github/commits";

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

const WINDOW_MS = 30 * 60 * 1000;

export function matchFindings(
  findings: readonly MatchInput[],
  commits: readonly RepoCommit[],
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const f of findings) {
    // 1단계: 같은 청크의 로그 커밋 → sha 접두사로 GitHub 커밋 확정.
    const logMatch = f.chunkCommitShas
      .map((short) => commits.find((c) => c.sha.startsWith(short)))
      .find((c) => c !== undefined);
    if (logMatch) {
      results.push({ findingId: f.findingId, sha: logMatch.sha, method: "log", score: 1 });
      continue;
    }

    // 2단계: 시간 창.
    if (!f.quoteTs) continue;
    const t = Date.parse(f.quoteTs);
    if (Number.isNaN(t)) continue;
    let best: { sha: string; score: number } | undefined;
    for (const c of commits) {
      if (!c.authoredAt) continue;
      const dt = Math.abs(Date.parse(c.authoredAt) - t);
      if (dt > WINDOW_MS) continue;
      const score = 1 - dt / WINDOW_MS;
      if (!best || score > best.score) best = { sha: c.sha, score };
    }
    if (best) {
      results.push({
        findingId: f.findingId,
        sha: best.sha,
        method: "time",
        score: Number(best.score.toFixed(3)),
      });
    }
  }
  return results;
}
