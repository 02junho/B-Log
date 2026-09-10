/**
 * 잡 처리기 (P2 초안, P1 작성 9/10).
 *
 * parse 잡: Storage의 원본 로그 → 파싱·청킹 → chunks 저장 → tag 잡 생성.
 * tag 잡: next_idx부터 청크 배치를 태깅(동시성 5) → findings 저장 → 진행률 갱신.
 *   한 번의 run 호출은 TAG_BATCH개까지만 처리하고 남으면 continue=true를 돌려준다
 *   (Vercel 300초 안에서 안전하게 재개 — jobs.next_idx가 재개 지점).
 * match·publish 잡: P2 구현 예정 (지금은 501).
 */
import { parseSession } from "../parser";
import { sessionStats } from "../parser/stats";
import { chunkSession, type Chunk } from "../pipeline/chunk";
import { tagSession } from "../pipeline/tag";
import type { Db } from "../supabase/server";

/** run 1회가 처리하는 최대 청크 수. 실측 ~5s/청크·동시성 5 기준 여유 있게. */
const TAG_BATCH = 25;
const TAG_CONCURRENCY = 5;

type JobRow = {
  id: string;
  session_id: string;
  kind: string;
  status: string;
  progress: number;
  next_idx: number;
};

export interface ProcessResult {
  status: "done" | "running" | "failed";
  progress: number;
  continue: boolean;
  nextJobId?: string;
  error?: string;
}

function chunkIdx(chunk: Chunk): number {
  return Number(chunk.id.replace(/^c/, ""));
}

export async function processJob(db: Db, job: JobRow): Promise<ProcessResult> {
  try {
    if (job.kind === "parse") return await runParse(db, job);
    if (job.kind === "tag") return await runTag(db, job);
    return {
      status: "failed",
      progress: job.progress,
      continue: false,
      error: `not implemented: ${job.kind}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err);
    await db.from("jobs").update({ status: "failed", error: message }).eq("id", job.id);
    await db.from("sessions").update({ status: "failed" }).eq("id", job.session_id);
    return { status: "failed", progress: job.progress, continue: false, error: message };
  }
}

async function runParse(db: Db, job: JobRow): Promise<ProcessResult> {
  const { data: sessionRow, error: sErr } = await db
    .from("sessions")
    .select("id, storage_path")
    .eq("id", job.session_id)
    .single();
  if (sErr || !sessionRow) throw new Error(`session not found: ${sErr?.message}`);

  const { data: blob, error: dErr } = await db.storage
    .from("logs")
    .download(sessionRow.storage_path);
  if (dErr || !blob) throw new Error(`storage download failed: ${dErr?.message}`);

  const session = parseSession((await blob.text()).split("\n"));
  const stats = sessionStats(session);
  const chunks = chunkSession(session);

  // 재실행 대비: 이 세션의 기존 청크를 지우고 새로 넣는다 (findings는 CASCADE).
  await db.from("chunks").delete().eq("session_id", job.session_id);
  const { error: cErr } = await db.from("chunks").insert(
    chunks.map((c) => ({
      session_id: job.session_id,
      idx: chunkIdx(c),
      start_ts: c.startTs ?? null,
      end_ts: c.endTs ?? null,
      text: c.text,
      tool_calls: { eventIds: c.eventIds },
    })),
  );
  if (cErr) throw new Error(`chunks insert failed: ${cErr.message}`);

  await db
    .from("sessions")
    .update({ status: "processing", stats: JSON.parse(JSON.stringify(stats)) })
    .eq("id", job.session_id);
  await db.from("jobs").update({ status: "done", progress: 100 }).eq("id", job.id);

  const { data: tagJob, error: jErr } = await db
    .from("jobs")
    .insert({ session_id: job.session_id, kind: "tag", status: "queued" })
    .select("id")
    .single();
  if (jErr || !tagJob) throw new Error(`tag job create failed: ${jErr?.message}`);

  return { status: "done", progress: 100, continue: false, nextJobId: tagJob.id };
}

async function runTag(db: Db, job: JobRow): Promise<ProcessResult> {
  const { count } = await db
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", job.session_id);
  const total = count ?? 0;
  if (total === 0) throw new Error("no chunks to tag");

  const { data: rows, error: cErr } = await db
    .from("chunks")
    .select("id, idx, text, tool_calls")
    .eq("session_id", job.session_id)
    .gte("idx", job.next_idx)
    .order("idx")
    .limit(TAG_BATCH);
  if (cErr) throw new Error(`chunks fetch failed: ${cErr.message}`);

  if (rows && rows.length > 0) {
    await db.from("jobs").update({ status: "running" }).eq("id", job.id);
    const idByIdx = new Map(rows.map((r) => [r.idx, r.id]));
    const chunks: Chunk[] = rows.map((r) => ({
      id: `c${String(r.idx).padStart(3, "0")}`,
      eventIds:
        ((r.tool_calls as { eventIds?: string[] } | null)?.eventIds ?? []),
      text: r.text,
    }));

    const tagged = await tagSession(chunks, { concurrency: TAG_CONCURRENCY });
    if (tagged.findings.length > 0) {
      const rowsToInsert = tagged.findings.flatMap((f) => {
        const chunkRowId = idByIdx.get(Number(f.chunkId.replace(/^c/, "")));
        if (!chunkRowId) return [];
        return [{
          session_id: job.session_id,
          chunk_id: chunkRowId,
          stage: f.stage,
          summary: f.summary,
          quote: f.quote,
          confidence: f.confidence,
        }];
      });
      const { error: fErr } = await db.from("findings").insert(rowsToInsert);
      if (fErr) throw new Error(`findings insert failed: ${fErr.message}`);
    }
  }

  const lastIdx = rows && rows.length > 0 ? rows[rows.length - 1].idx : job.next_idx;
  const processedUpTo = lastIdx + 1;
  const remaining = rows ? rows.length === TAG_BATCH : false;
  const progress = Math.min(99, Math.round((processedUpTo / (total + 1)) * 100));

  if (remaining) {
    await db
      .from("jobs")
      .update({ next_idx: processedUpTo, progress })
      .eq("id", job.id);
    return { status: "running", progress, continue: true };
  }

  await db
    .from("jobs")
    .update({ status: "done", progress: 100, next_idx: processedUpTo })
    .eq("id", job.id);
  await db.from("sessions").update({ status: "ready" }).eq("id", job.session_id);
  return { status: "done", progress: 100, continue: false };
}
