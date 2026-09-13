import type { Db } from "./supabase/server";

export type DashboardEntry = {
  id: string;
  projectName: string;
  repoUrl: string | null;
  sourceTool: string;
  createdAt: string;
  state: "uploaded" | "processing" | "ready" | "review" | "published" | "failed";
  portfolio: { title: string; slug: string; publishedAt: string | null } | null;
};

type PortfolioRow = {
  session_id: string;
  title: string;
  slug: string;
  published_at: string | null;
  created_at: string;
};

export async function getDashboardEntries(
  db: Db,
  userId: string,
): Promise<DashboardEntry[]> {
  const { data: projects, error: projectError } = await db
    .from("projects")
    .select("id, name, repo_url")
    .eq("owner_id", userId);
  if (projectError) throw new Error("Dashboard unavailable");
  if (!projects?.length) return [];

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const { data: sessions, error: sessionError } = await db
    .from("sessions")
    .select("id, project_id, source_tool, status, created_at")
    .in("project_id", projects.map((project) => project.id))
    .order("created_at", { ascending: false })
    .limit(20);
  if (sessionError) throw new Error("Dashboard unavailable");
  if (!sessions?.length) return [];

  const { data: portfolios, error: portfolioError } = await db
    .from("portfolios")
    .select("session_id, title, slug, published_at, created_at")
    .in("session_id", sessions.map((session) => session.id))
    .order("created_at", { ascending: false });
  if (portfolioError) throw new Error("Dashboard unavailable");

  const portfolioBySession = new Map<string, PortfolioRow>();
  for (const portfolio of portfolios ?? []) {
    if (!portfolioBySession.has(portfolio.session_id)) {
      portfolioBySession.set(portfolio.session_id, portfolio);
    }
  }

  return sessions.flatMap((session) => {
    const project = projectById.get(session.project_id);
    if (!project) return [];
    const portfolio = portfolioBySession.get(session.id) ?? null;
    const state = portfolio?.published_at
      ? "published"
      : portfolio
        ? "review"
        : session.status === "failed"
          ? "failed"
          : session.status === "ready"
            ? "ready"
            : session.status === "processing"
              ? "processing"
              : "uploaded";
    return [{
      id: session.id,
      projectName: project.name,
      repoUrl: project.repo_url,
      sourceTool: session.source_tool,
      createdAt: session.created_at,
      state,
      portfolio: portfolio
        ? {
            title: portfolio.title,
            slug: portfolio.slug,
            publishedAt: portfolio.published_at,
          }
        : null,
    } satisfies DashboardEntry];
  });
}
