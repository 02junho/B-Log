/**
 * POST /api/jobs/[id]/run — 잡을 한 배치 실행.
 * continue=true면 클라이언트가 다시 호출해 이어간다 (jobs.next_idx가 재개 지점).
 * 초안 한계(P2 검토 항목): 인증 없음, 동시 run 호출에 대한 잠금은 status 검사뿐.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { processJob } from "@/lib/jobs/process";
import type { ApiError, JobRunResponse } from "@/lib/api/types";

// Vercel Hobby 함수 상한. 태깅 배치(25청크 × ~5s ÷ 동시성 5)에 충분.
export const maxDuration = 300;

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const db = getSupabaseServerClient();
  if (!db) {
    return Response.json({ error: "db not configured" } satisfies ApiError, { status: 503 });
  }
  const { id } = await ctx.params;

  const { data: job, error } = await db
    .from("jobs")
    .select("id, session_id, kind, status, progress, next_idx")
    .eq("id", id)
    .single();
  if (error || !job) {
    return Response.json({ error: "job not found" } satisfies ApiError, { status: 404 });
  }
  if (job.status === "done" || job.status === "failed") {
    return Response.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      continue: false,
    } satisfies JobRunResponse);
  }

  const result = await processJob(db, job);
  return Response.json({
    id: job.id,
    status: result.status,
    progress: result.progress,
    continue: result.continue,
    ...(result.nextJobId ? { nextJobId: result.nextJobId } : {}),
    ...(result.error ? { error: result.error } : {}),
  } satisfies JobRunResponse);
}
