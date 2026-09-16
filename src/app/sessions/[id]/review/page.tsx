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

type Masking = NonNullable<
  import("zod").infer<typeof portfolioDisplaySchema>["masking"]
>;

/**
 * 자동 마스킹이 어디까지 돌았는지 사람에게 알린다.
 * 2차가 빠진 초안(필드 없음)과 열화(regex-only)는 똑같이 경고로 취급한다 —
 * 무엇을 믿고 보는지 모르면 눈검사가 의미를 잃는다.
 */
function MaskingNotice({ masking }: { masking?: Masking }) {
  const degraded = !masking || masking.level === "regex-only";
  return (
    <div
      className={`review-banner${degraded ? " is-warning" : ""}`}
      role={degraded ? "alert" : "status"}
    >
      <strong>{degraded ? "자동 마스킹 미완료" : "자동 마스킹 적용됨"}</strong>
      <span>
        {degraded ? (
          <>
            정규식 규칙만 적용됐습니다
            {masking?.degradedReason ? ` (${masking.degradedReason})` : ""}.
            사람 이름·내부 주소·사내 코드명은 걸러지지 않았을 수 있으니 직접
            확인하세요.
          </>
        ) : (
          <>
            정규식 {masking.regexTotal}건, AI 검출 {masking.llmApplied}건을
            가렸습니다. 자동 검출은 완벽하지 않으니 아래 인용을 눈으로 확인해
            주세요.
          </>
        )}
      </span>
    </div>
  );
}

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
      <SiteHeader authenticated />
      <div className="review-banner" role="status">
        <strong>발행 전 검수</strong>
        <span>
          아래 내용이 그대로 공개됩니다. 개인정보나 남기고 싶지 않은 내용이
          보이면 발행하지 말고 팀에 알려주세요.
        </span>
      </div>
      <MaskingNotice masking={parsed.data.masking} />
      <ConfirmPublish
        sessionId={id}
        publicPath={`/p/${data.slug}`}
        alreadyPublished={Boolean(data.published_at)}
      />
      <PortfolioView view={parsed.data} mode="review" />
    </>
  );
}
