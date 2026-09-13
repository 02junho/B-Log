import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/auth";
import { ownsSession } from "@/lib/auth/access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { portfolioDisplaySchema } from "@/lib/portfolio/presentation";
import { PortfolioView } from "@/components/portfolio-view";
import { SiteHeader } from "@/components/site-header";
import { ConfirmPublish } from "@/components/confirm-publish";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "발행 전 검수 | B-Log",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 발행 전 검수 화면. 초안(published_at=null)을 공개 페이지와 똑같이 렌더해
 * 보여주고, "발행 확정"이 confirm API를 호출한다.
 * 초안을 읽기 전에 인증된 사용자와 프로젝트 소유자가 같은지 검사한다.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getAuthUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/sessions/${id}/review`)}`);
  const db = getSupabaseServerClient();
  if (!db) throw new Error("Review unavailable");
  if (!(await ownsSession(db, id, user.id))) notFound();

  const { data, error } = await db
    .from("portfolios")
    .select("view, slug, published_at")
    .eq("session_id", id)
    .maybeSingle();
  if (error) throw new Error("Draft could not be loaded");
  if (!data) notFound();
  const parsed = portfolioDisplaySchema.safeParse(data.view);
  if (!parsed.success) throw new Error("Draft format unavailable");

  return (
    <>
      <SiteHeader />
      <div className="review-banner" role="status">
        <strong>발행 전 검수</strong>
        <span>
          아래 내용이 그대로 공개됩니다. 개인정보나 남기고 싶지 않은 내용이
          보이면 발행하지 말고 팀에 알려주세요.
        </span>
      </div>
      <ConfirmPublish
        sessionId={id}
        publicPath={`/p/${data.slug}`}
        alreadyPublished={Boolean(data.published_at)}
      />
      <PortfolioView view={parsed.data} mode="review" />
    </>
  );
}
