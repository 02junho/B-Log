/**
 * GitHub 공개 레포 커밋 조회 (매칭 2·3단계 재료).
 * GitHub REST를 표준 fetch로 호출한다 (Octokit과 같은 엔드포인트 — 의존성 절감,
 * P2가 Octokit을 선호하면 이 파일만 교체하면 된다).
 * GITHUB_TOKEN이 있으면 rate limit이 60→5000/h로 늘어난다 (선택).
 */

export interface RepoCommit {
  sha: string;
  message: string;
  authoredAt?: string;
  files?: string[];
}

/** https://github.com/owner/repo(.git) → {owner, repo}. 아니면 null. */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** 최근 커밋 최대 300개 (100 × 3페이지). 파일 목록은 조회하지 않는다(호출 폭증 방지). */
export async function fetchRepoCommits(repoUrl: string): Promise<RepoCommit[]> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error(`invalid GitHub repo url: ${repoUrl}`);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "b-log",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const commits: RepoCommit[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=100&page=${page}`,
      { headers },
    );
    if (res.status === 404) throw new Error("repo not found or private");
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const body = (await res.json()) as {
      sha: string;
      commit: { message: string; author?: { date?: string } };
    }[];
    for (const c of body) {
      commits.push({
        sha: c.sha,
        message: c.commit.message.split("\n")[0],
        authoredAt: c.commit.author?.date,
      });
    }
    if (body.length < 100) break;
  }
  return commits;
}
