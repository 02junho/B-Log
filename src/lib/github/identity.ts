/**
 * 업로더의 GitHub 계정 ↔ 커밋 작성자 대조 (커밋 매칭 2단계의 귀속 확인).
 *
 * 시간 창만으로 커밋을 붙이면 같은 레포에서 일한 팀원의 커밋이 내 과정으로
 * 보인다. 포트폴리오는 "내가 지휘해 만든 결과"를 주장하므로, 추정 연결은
 * 업로더 본인이 작성한 커밋에만 허용한다.
 */
import type { RepoCommit } from "./commits";

export interface GitHubIdentity {
  /** GitHub 사용자 숫자 id (문자열). 로그인명이 바뀌어도 유지된다. */
  id?: string;
  login?: string;
}

/** Supabase User 중 여기서 읽는 부분만 — 테스트에서 가짜 사용자를 쓰기 위해. */
export interface AuthUserLike {
  identities?: { provider: string; identity_data?: Record<string, unknown> }[] | null;
  user_metadata?: Record<string, unknown> | null;
}

function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * GitHub OAuth로 가입한 Supabase 사용자에서 GitHub 계정을 꺼낸다.
 * identities의 github 항목이 원본이고, user_metadata는 그 사본이라 대체로만 쓴다.
 * 둘 다 없으면(다른 방식으로 가입) undefined — 호출부는 귀속을 확인할 수 없다고 본다.
 */
export function githubIdentityOf(user: AuthUserLike | null | undefined): GitHubIdentity | undefined {
  if (!user) return undefined;
  const data = user.identities?.find((i) => i.provider === "github")?.identity_data;
  const meta = user.user_metadata ?? undefined;
  const id = str(data?.provider_id) ?? str(data?.sub) ?? str(meta?.provider_id);
  const login =
    str(data?.user_name) ?? str(data?.preferred_username) ??
    str(meta?.user_name) ?? str(meta?.preferred_username);
  if (!id && !login) return undefined;
  return { ...(id ? { id } : {}), ...(login ? { login } : {}) };
}

/**
 * 이 커밋을 업로더가 작성했는지. id가 양쪽에 있으면 id로만 판정한다
 * (로그인명은 바뀌거나 재사용될 수 있다). 확인할 수 없으면 false.
 */
export function isAuthoredBy(commit: RepoCommit, who: GitHubIdentity): boolean {
  if (commit.authorId && who.id) return commit.authorId === who.id;
  if (commit.authorLogin && who.login) {
    return commit.authorLogin.toLowerCase() === who.login.toLowerCase();
  }
  return false;
}
