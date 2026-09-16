import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getDashboardEntries, type DashboardEntry } from "@/lib/dashboard";
import { getAuthUser } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "내 작업공간 | B-Log",
  description: "분석 중인 작업과 발행한 과정 포트폴리오를 확인합니다.",
  robots: { index: false, follow: false },
};

const stateCopy: Record<DashboardEntry["state"], { label: string; detail: string }> = {
  uploaded: { label: "업로드됨", detail: "분석을 시작할 준비가 됐습니다." },
  processing: { label: "분석 중", detail: "로그에서 중요한 과정을 찾고 있습니다." },
  ready: { label: "분석 완료", detail: "포트폴리오 초안을 준비하고 있습니다." },
  review: { label: "검수 필요", detail: "공개 전에 내용을 직접 확인해주세요." },
  published: { label: "공개됨", detail: "공개 링크로 포트폴리오를 확인할 수 있습니다." },
  failed: { label: "확인 필요", detail: "분석을 완료하지 못했습니다. 새 분석으로 다시 시도해주세요." },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function EntryAction({ entry }: { entry: DashboardEntry }) {
  if (entry.state === "published" && entry.portfolio) {
    return <Link className="dashboard-card-link" href={`/p/${entry.portfolio.slug}`}>포트폴리오 보기 <span aria-hidden="true">↗</span></Link>;
  }
  if (entry.state === "review") {
    return <Link className="dashboard-card-link" href={`/sessions/${entry.id}/review`}>검수 계속하기 <span aria-hidden="true">→</span></Link>;
  }
  if (["uploaded", "processing", "ready"].includes(entry.state)) {
    return <Link className="dashboard-card-link" href={`/sessions/${entry.id}/progress`}>분석 이어가기 <span aria-hidden="true">→</span></Link>;
  }
  return null;
}

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=%2Fdashboard");
  const db = getSupabaseServerClient();
  if (!db) throw new Error("Dashboard unavailable");
  const entries = await getDashboardEntries(db, user.id);
  const reviewCount = entries.filter((entry) => entry.state === "review").length;
  const publishedCount = entries.filter((entry) => entry.state === "published").length;

  return (
    <>
      <SiteHeader authenticated />
      <main id="main-content" className="dashboard-page">
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">MY BUILD LOG</span>
            <h1>이어갈 작업을 한눈에.</h1>
            <p>분석 중인 기록을 확인하고, 검수를 마친 과정을 포트폴리오로 공개하세요.</p>
          </div>
          <Link className="button button-dark" href="/new">새 로그 분석하기 <span aria-hidden="true">→</span></Link>
        </section>

        <section className="dashboard-summary" aria-label="작업 요약">
          <div><strong>{entries.length}</strong><span>전체 기록</span></div>
          <div><strong>{reviewCount}</strong><span>검수 필요</span></div>
          <div><strong>{publishedCount}</strong><span>공개 포트폴리오</span></div>
        </section>

        <section className="dashboard-list" aria-labelledby="recent-work">
          <div className="dashboard-section-heading">
            <div><span className="eyebrow">RECENT WORK</span><h2 id="recent-work">최근 작업</h2></div>
            {entries.length > 0 && <span>최근 {entries.length}개</span>}
          </div>
          {entries.length === 0 ? (
            <div className="dashboard-empty">
              <span className="brand-mark" aria-hidden="true">b<span>·</span></span>
              <h3>아직 분석한 기록이 없습니다.</h3>
              <p>첫 AI 코딩 세션 로그를 올리고, 결과보다 중요한 작업 과정을 남겨보세요.</p>
              <Link className="button button-dark" href="/new">첫 로그 분석하기</Link>
            </div>
          ) : (
            <div className="dashboard-grid">
              {entries.map((entry) => {
                const copy = stateCopy[entry.state];
                return (
                  <article className="dashboard-card" key={entry.id}>
                    <div className="dashboard-card-top">
                      <span className={`dashboard-status status-${entry.state}`}>{copy.label}</span>
                      <span>{entry.sourceTool === "claude-code" ? "Claude Code" : entry.sourceTool === "codex" ? "Codex" : "대화록"}</span>
                    </div>
                    <div>
                      <h3>{entry.portfolio?.title || entry.projectName}</h3>
                      <p>{copy.detail}</p>
                    </div>
                    <div className="dashboard-card-meta">
                      <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                      {entry.repoUrl && <span>{entry.repoUrl.replace(/^https?:\/\/github\.com\//, "")}</span>}
                    </div>
                    <EntryAction entry={entry} />
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <form className="dashboard-logout" action="/auth/logout" method="post">
          <button className="text-button">로그아웃</button>
        </form>
      </main>
    </>
  );
}
