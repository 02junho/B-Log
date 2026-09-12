/**
 * POST /api/sessions/[id]/confirm — 검수 확정.
 * publish가 만든 초안(published_at=null)을 공개로 전환한다.
 * 이미 공개된 포트폴리오에 다시 호출하면 그대로 성공을 돌려준다(멱등).
 */
import { checkApiToken } from "@/lib/api/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiError, ConfirmResponse } from "@/lib/api/types";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = checkApiToken(request);
  if (denied) return denied;
  const db = getSupabaseServerClient();
  if (!db) {
    return Response.json({ error: "db not configured" } satisfies ApiError, { status: 503 });
  }
  const { id } = await ctx.params;

  const { data: portfolio, error } = await db
    .from("portfolios")
    .select("id, slug, published_at")
    .eq("session_id", id)
    .maybeSingle();
  if (error) {
    return Response.json({ error: error.message } satisfies ApiError, { status: 500 });
  }
  if (!portfolio) {
    return Response.json(
      { error: "no portfolio draft for this session" } satisfies ApiError,
      { status: 404 },
    );
  }

  let publishedAt = portfolio.published_at;
  if (!publishedAt) {
    publishedAt = new Date().toISOString();
    const { error: uErr } = await db
      .from("portfolios")
      .update({ published_at: publishedAt })
      .eq("id", portfolio.id);
    if (uErr) {
      return Response.json({ error: uErr.message } satisfies ApiError, { status: 500 });
    }
  }

  return Response.json({
    sessionId: id,
    slug: portfolio.slug,
    path: `/p/${portfolio.slug}`,
    publishedAt,
  } satisfies ConfirmResponse);
}
