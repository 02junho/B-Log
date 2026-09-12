/**
 * POST /api/sessions/[id]/publish — 분석 완료(ready) 세션을 **검수용 초안**으로 조립.
 * match 잡 → publish 잡을 순서대로 실행한다 (LLM 없음, 수 초).
 * 여기서는 공개되지 않는다: portfolios 행은 published_at=null 초안으로 만들어지고,
 * 사용자가 /sessions/[id]/review에서 확인한 뒤 confirm이 공개를 확정한다.
 */
import { checkApiToken } from "@/lib/api/guard";
import { processJob } from "@/lib/jobs/process";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiError, PublishResponse } from "@/lib/api/types";

export const maxDuration = 300;

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

  const { data: session, error: sErr } = await db
    .from("sessions")
    .select("id, status")
    .eq("id", id)
    .single();
  if (sErr || !session) {
    return Response.json({ error: "session not found" } satisfies ApiError, { status: 404 });
  }
  if (session.status !== "ready") {
    return Response.json(
      { error: `session is ${session.status}, not ready` } satisfies ApiError,
      { status: 409 },
    );
  }

  const runKind = async (kind: "match" | "publish"): Promise<string> => {
    const { data: job, error } = await db
      .from("jobs")
      .insert({ session_id: id, kind, status: "queued" })
      .select("id, session_id, kind, status, progress, next_idx")
      .single();
    if (error || !job) throw new Error(`${kind} job create failed: ${error?.message}`);
    const result = await processJob(db, job);
    if (result.status !== "done") {
      throw new Error(`${kind} failed: ${result.error ?? "unknown"}`);
    }
    return job.id;
  };

  try {
    const matchJobId = await runKind("match");
    const publishJobId = await runKind("publish");
    const { data: portfolio } = await db
      .from("portfolios")
      .select("slug")
      .eq("session_id", id)
      .single();
    return Response.json({
      sessionId: id,
      slug: portfolio?.slug ?? "",
      path: `/p/${portfolio?.slug ?? ""}`,
      reviewPath: `/sessions/${id}/review`,
      matchJobId,
      publishJobId,
    } satisfies PublishResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message } satisfies ApiError, { status: 500 });
  }
}
