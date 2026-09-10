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
  // 선점: queued → running 전이에 성공한 호출만 실행한다 (이중 실행 방지).
  const { data: claimed, error: clErr } = await db
    .from("jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id");
  if (clErr) throw new Error(`parse claim failed: ${clErr.message}`);
  if (!claimed || claimed.length === 0) {
    // 다른 호출이 실행 중. chunks unique(session_id, idx) 제약이 최후 방어선이다.
    return { status: "running", progress: job.progress, continue: true };
  }

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

/**
 * 배치 선점(낙관적 잠금): 작업 전에 next_idx를 조건부로 전진시킨다.
 * next_idx가 기대값과 같을 때만 갱신되므로, run이 동시에 여러 번 와도
 * 배치 하나는 정확히 한 호출만 소유한다 → findings 중복 없음.
 * 대가: 선점한 호출이 크래시하면 그 배치는 건너뛰어진다(중복보다 낫다 —
 * 복구는 세션 재파싱). 반환값 null = 다른 호출이 선점 중.
 */
async function claimTagBatch(db: Db, job: JobRow): Promise<number | null> {
  const { data, error } = await db
    .from("jobs")
    .update({
      status: "running",
      next_idx: job.next_idx + TAG_BATCH,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("next_idx", job.next_idx)
    .in("status", ["queued", "running"])
    .select("id");
  if (error) throw new Error(`batch claim failed: ${error.message}`);
  return data && data.length > 0 ? job.next_idx : null;
}

async function runTag(db: Db, job: JobRow): Promise<ProcessResult> {
  const { count } = await db
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", job.session_id);
  const total = count ?? 0;
  if (total === 0) throw new Error("no chunks to tag");

  const batchStart = await claimTagBatch(db, job);
  if (batchStart === null) {
    // 다른 run 호출이 이 배치를 이미 선점했다. 그쪽이 이어가므로 여기선 손대지 않는다.
    return {
      status: "running",
      progress: job.progress,
      continue: true,
    };
  }

  const { data: rows, error: cErr } = await db
    .from("chunks")
    .select("id, idx, text, tool_calls")
    .eq("session_id", job.session_id)
    .gte("idx", batchStart)
    .lt("idx", batchStart + TAG_BATCH)
    .order("idx");
  if (cErr) throw new Error(`chunks fetch failed: ${cErr.message}`);

  if (rows && rows.length > 0) {
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

  // 남은 배치 판정은 실제 존재 여부로 한다 (idx가 1부터 시작해 첫 배치가
  // TAG_BATCH보다 작게 잡히는 경계에서도 안전).
  const { count: remainCount } = await db
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("session_id", job.session_id)
    .gte("idx", batchStart + TAG_BATCH);
  const remaining = (remainCount ?? 0) > 0;
  const progress = Math.min(
    99,
    Math.round((Math.min(batchStart + TAG_BATCH, total) / (total + 1)) * 100),
  );

  if (remaining) {
    await db
      .from("jobs")
      .update({ progress, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return { status: "running", progress, continue: true };
  }

  // 마지막 배치. 완료 처리는 멱등이라 경쟁 호출이 겹쳐도 안전하다.
  await db
    .from("jobs")
    .update({ status: "done", progress: 100, updated_at: new Date().toISOString() })
    .eq("id", job.id);
  await db.from("sessions").update({ status: "ready" }).eq("id", job.session_id);
  return { status: "done", progress: 100, continue: false };
}
