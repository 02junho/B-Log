import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResumeAnalysis } from "@/components/resume-analysis";
import { SiteHeader } from "@/components/site-header";
import { ownsSession } from "@/lib/auth/access";
import type { SessionStatus } from "@/lib/api/types";
import { getAuthUser } from "@/lib/supabase/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "분석 이어가기 | B-Log", robots: { index: false, follow: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getAuthUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/sessions/${id}/progress`)}`);
  const db = getSupabaseServerClient();
  if (!db) throw new Error("Analysis unavailable");
  if (!(await ownsSession(db, id, user.id))) notFound();

  const [sessionResult, portfolioResult, jobResult] = await Promise.all([
    db.from("sessions").select("status").eq("id", id).single(),
    db.from("portfolios").select("slug, published_at").eq("session_id", id).maybeSingle(),
    db.from("jobs").select("id, status").eq("session_id", id).in("kind", ["parse", "tag"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (sessionResult.error || portfolioResult.error || jobResult.error) {
    throw new Error("Analysis status unavailable");
  }
  const session = sessionResult.data;
  const portfolio = portfolioResult.data;
  const job = jobResult.data;
  if (!session) notFound();
  if (portfolio) redirect(portfolio.published_at ? `/p/${portfolio.slug}` : `/sessions/${id}/review`);
  const status = session.status as SessionStatus;

  return (
    <>
      <SiteHeader authenticated />
      <main id="main-content" className="upload-page resume-page">
        <span className="eyebrow">RESUME ANALYSIS</span>
        <h1>분석을 이어서 완료하세요.</h1>
        <p className="upload-lede">브라우저를 닫았거나 새로고침했어도 서버에 저장된 진행 지점부터 계속할 수 있습니다.</p>
        <section className="upload-card">
          {status === "failed" || job?.status === "failed" ? (
            <><h2>이 작업은 자동으로 재개할 수 없습니다.</h2><p>실패 원인을 확인한 뒤 원본 로그로 새 분석을 시작해주세요.</p><Link className="button button-dark" href="/new">새 분석 시작</Link></>
          ) : (
            <><h2>{status === "ready" ? "분석 결과가 준비됐습니다." : "중단된 지점이 저장돼 있습니다."}</h2><p>{status === "ready" ? "검수용 초안을 만든 뒤 공개할 내용을 확인하세요." : "버튼을 누르면 남은 분석을 실행하고 검수용 초안을 만듭니다."}</p><ResumeAnalysis sessionId={id} sessionStatus={status} jobId={job?.id ?? null} /></>
          )}
        </section>
      </main>
    </>
  );
}
