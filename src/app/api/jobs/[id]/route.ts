/** GET /api/jobs/[id] — 잡 상태·진행률 (P3 폴링용). */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authenticate } from "@/lib/auth/api";
import { requireSessionOwner } from "@/lib/auth/access";
import type { ApiError, JobStatusResponse } from "@/lib/api/types";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const db = getSupabaseServerClient();
  if (!db) {
    return Response.json({ error: "db not configured" } satisfies ApiError, {
      status: 503,
    });
  }
  const { id } = await ctx.params;

  const { data: job, error } = await db
    .from("jobs")
    .select("id, session_id, kind, status, progress, error")
    .eq("id", id)
    .single();
  if (error || !job) {
    return Response.json({ error: "job not found" } satisfies ApiError, {
      status: 404,
    });
  }

  const denied = await requireSessionOwner(db, job.session_id, auth.userId);
  if (denied) return denied;
  const { data: sessionRow } = await db
    .from("sessions")
    .select("status")
    .eq("id", job.session_id)
    .single();

  // parse 잡이 끝났으면 이 세션의 다음 tag 잡을 알려준다.
  let nextJobId: string | undefined;
  if (job.kind === "parse" && job.status === "done") {
    const { data: next } = await db
      .from("jobs")
      .select("id")
      .eq("session_id", job.session_id)
      .eq("kind", "tag")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    nextJobId = next?.id;
  }

  return Response.json({
    id: job.id,
    sessionId: job.session_id,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    ...(job.error ? { error: job.error } : {}),
    ...(nextJobId ? { nextJobId } : {}),
    sessionStatus: sessionRow?.status ?? "failed",
  } as JobStatusResponse);
}
