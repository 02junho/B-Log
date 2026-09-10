/**
 * POST /api/upload — 로그 파일 업로드 → Storage 저장 → session·parse 잡 생성.
 * multipart/form-data: file(필수), projectName?, repoUrl?
 *
 * 초안 한계(P2 검토 항목): 인증·일일 상한 없음(공개 배포 전 필수),
 * 대화록(transcript) 경로 미구현(422), 파일 상한 15MB.
 */
import { randomUUID } from "node:crypto";
import { detectFormat } from "@/lib/parser";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiError, UploadResponse } from "@/lib/api/types";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const db = getSupabaseServerClient();
  if (!db) {
    return Response.json({ error: "db not configured" } satisfies ApiError, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return Response.json({ error: "file field required (multipart/form-data)" } satisfies ApiError, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ error: `file size must be 1B~${MAX_BYTES}B` } satisfies ApiError, { status: 413 });
  }

  const text = await file.text();
  const lines = text.split("\n");
  const detected = detectFormat(lines);
  if (!detected) {
    // MVP: 범용 대화록 경로는 미구현 (TEAM_PLAN 컷 순서 2번).
    return Response.json(
      { error: "unsupported log format (Claude Code / Codex JSONL only for now)" } satisfies ApiError,
      { status: 422 },
    );
  }

  const storagePath = `sessions/${randomUUID()}.jsonl`;
  const { error: upErr } = await db.storage
    .from("logs")
    .upload(storagePath, text, { contentType: "application/jsonl" });
  if (upErr) {
    return Response.json({ error: `storage upload failed: ${upErr.message}` } satisfies ApiError, { status: 500 });
  }

  const projectName =
    (form.get("projectName") as string | null)?.slice(0, 200) || file.name || "untitled";
  const repoUrl = (form.get("repoUrl") as string | null) || null;

  const { data: project, error: pErr } = await db
    .from("projects")
    .insert({ name: projectName, repo_url: repoUrl })
    .select("id")
    .single();
  if (pErr || !project) {
    return Response.json({ error: `project insert failed: ${pErr?.message}` } satisfies ApiError, { status: 500 });
  }

  const fidelity = detected === "transcript" ? "transcript" : "structured";
  const { data: session, error: sErr } = await db
    .from("sessions")
    .insert({
      project_id: project.id,
      source_tool: detected,
      fidelity,
      storage_path: storagePath,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (sErr || !session) {
    return Response.json({ error: `session insert failed: ${sErr?.message}` } satisfies ApiError, { status: 500 });
  }

  const { data: job, error: jErr } = await db
    .from("jobs")
    .insert({ session_id: session.id, kind: "parse", status: "queued" })
    .select("id")
    .single();
  if (jErr || !job) {
    return Response.json({ error: `job insert failed: ${jErr?.message}` } satisfies ApiError, { status: 500 });
  }

  return Response.json({
    projectId: project.id,
    sessionId: session.id,
    jobId: job.id,
    sourceTool: detected,
    fidelity,
  } satisfies UploadResponse);
}
