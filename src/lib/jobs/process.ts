/**
 * 잡 처리기 (P2 초안, P1 작성 9/10).
 *
 * parse 잡: Storage의 원본 로그 → 파싱·청킹 → chunks 저장 → tag 잡 생성.
 * tag 잡: next_idx부터 청크 배치를 태깅(동시성 5) → findings 저장 → 진행률 갱신.
 *   한 번의 run 호출은 TAG_BATCH개까지만 처리하고 남으면 continue=true를 돌려준다
 *   (Vercel 300초 안에서 안전하게 재개 — jobs.next_idx가 재개 지점).
 * match 잡: GitHub 커밋 조회 → 1단계(로그 sha)·2단계(±30분 창) 매칭 → matches 저장.
 * publish 잡: 원본 재파싱(LLM 없음) → PortfolioView 조립 → 마스킹 → portfolios 저장.
 */
import { parseSession } from "../parser";
import type { BLogSession } from "../parser/schema";
import { sessionStats } from "../parser/stats";
import { chunkSession, type Chunk } from "../pipeline/chunk";
import { tagSession, type TaggedFinding } from "../pipeline/tag";
import { buildPortfolioView } from "../portfolio/build";
import { fetchRepoCommits } from "../github/commits";
import { matchFindings, type MatchInput } from "../match/stages";
import { maskDeep } from "../masking/rules";
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
    if (job.kind === "match") return await runMatch(db, job);
    if (job.kind === "publish") return await runPublish(db, job);
    return {
      status: "failed",
      progress: job.progress,
      continue: false,
      error: `not implemented: ${job.kind}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err);
    await db.from("jobs").update({ status: "failed", error: message }).eq("id", job.id);
    // match·publish 실패는 분석 결과(ready)를 훼손하지 않는다.
    if (job.kind === "parse" || job.kind === "tag") {
      await db.from("sessions").update({ status: "failed" }).eq("id", job.session_id);
    }
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

/** queued → running 전이 선점 (match·publish 공용). null = 다른 호출이 실행 중. */
async function claimQueued(db: Db, jobId: string): Promise<boolean> {
  const { data, error } = await db
    .from("jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id");
  if (error) throw new Error(`claim failed: ${error.message}`);
  return Boolean(data && data.length > 0);
}

/** 세션 원본을 Storage에서 내려받아 다시 파싱 (LLM 없음, 수 초). */
async function loadParsedSession(
  db: Db,
  sessionId: string,
): Promise<{ session: BLogSession; repoUrl: string | null }> {
  const { data: row, error } = await db
    .from("sessions")
    .select("storage_path, project_id, projects(repo_url)")
    .eq("id", sessionId)
    .single();
  if (error || !row) throw new Error(`session not found: ${error?.message}`);
  const { data: blob, error: dErr } = await db.storage
    .from("logs")
    .download(row.storage_path);
  if (dErr || !blob) throw new Error(`storage download failed: ${dErr?.message}`);
  const repoUrl =
    (row.projects as unknown as { repo_url: string | null } | null)?.repo_url ?? null;
  return { session: parseSession((await blob.text()).split("\n")), repoUrl };
}

async function runMatch(db: Db, job: JobRow): Promise<ProcessResult> {
  if (!(await claimQueued(db, job.id))) {
    return { status: "running", progress: job.progress, continue: true };
  }
  const { session, repoUrl } = await loadParsedSession(db, job.session_id);

  if (!repoUrl) {
    // 레포 연결이 없으면 매칭할 대상이 없다 — 실패가 아니라 빈 완료.
    await db.from("jobs").update({ status: "done", progress: 100 }).eq("id", job.id);
    return { status: "done", progress: 100, continue: false };
  }

  // GitHub 커밋 조회 → commits 테이블 upsert
  const repoCommits = await fetchRepoCommits(repoUrl);
  const { data: project } = await db
    .from("sessions")
    .select("project_id")
    .eq("id", job.session_id)
    .single();
  const projectId = project!.project_id;
  if (repoCommits.length > 0) {
    const { error: uErr } = await db.from("commits").upsert(
      repoCommits.map((c) => ({
        project_id: projectId,
        sha: c.sha,
        message: c.message,
        authored_at: c.authoredAt ?? null,
      })),
      { onConflict: "project_id,sha" },
    );
    if (uErr) throw new Error(`commits upsert failed: ${uErr.message}`);
  }
  const { data: commitRows } = await db
    .from("commits")
    .select("id, sha, message, authored_at")
    .eq("project_id", projectId);
  const commitIdBySha = new Map((commitRows ?? []).map((c) => [c.sha, c.id]));

  // finding별 매칭 입력 구성: 인용 이벤트 ts + 같은 청크의 로그 커밋 sha
  const { data: chunkRows } = await db
    .from("chunks")
    .select("id, tool_calls")
    .eq("session_id", job.session_id);
  const eventIdsByChunk = new Map(
    (chunkRows ?? []).map((c) => [
      c.id,
      (c.tool_calls as { eventIds?: string[] } | null)?.eventIds ?? [],
    ]),
  );
  const eventById = new Map(session.events.map((e) => [e.id, e]));
  const { data: findingRows } = await db
    .from("findings")
    .select("id, chunk_id, quote")
    .eq("session_id", job.session_id);

  const inputs: MatchInput[] = (findingRows ?? []).map((f) => {
    const quote = f.quote as { eventId?: string };
    const quoteEvent = quote.eventId ? eventById.get(quote.eventId) : undefined;
    const chunkShas = (eventIdsByChunk.get(f.chunk_id) ?? [])
      .map((id) => eventById.get(id)?.gitCommit?.sha)
      .filter((sha): sha is string => Boolean(sha));
    return {
      findingId: f.id,
      ...(quoteEvent?.ts ? { quoteTs: quoteEvent.ts } : {}),
      chunkCommitShas: chunkShas,
    };
  });

  const matches = matchFindings(
    inputs,
    (commitRows ?? []).map((c) => ({
      sha: c.sha,
      message: c.message,
      ...(c.authored_at ? { authoredAt: c.authored_at } : {}),
    })),
  );

  // 재실행 대비: 이 세션 findings의 기존 매칭을 지우고 새로 넣는다.
  const findingIds = (findingRows ?? []).map((f) => f.id);
  if (findingIds.length > 0) {
    await db.from("matches").delete().in("finding_id", findingIds);
  }
  if (matches.length > 0) {
    const { error: mErr } = await db.from("matches").insert(
      matches.flatMap((m) => {
        const commitId = commitIdBySha.get(m.sha);
        return commitId
          ? [{ finding_id: m.findingId, commit_id: commitId, method: m.method, score: m.score }]
          : [];
      }),
    );
    if (mErr) throw new Error(`matches insert failed: ${mErr.message}`);
  }

  await db.from("jobs").update({ status: "done", progress: 100 }).eq("id", job.id);
  return { status: "done", progress: 100, continue: false };
}

function slugify(title: string, sessionId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "session"}-${sessionId.slice(0, 6)}`;
}

async function runPublish(db: Db, job: JobRow): Promise<ProcessResult> {
  if (!(await claimQueued(db, job.id))) {
    return { status: "running", progress: job.progress, continue: true };
  }
  const { session, repoUrl } = await loadParsedSession(db, job.session_id);

  // findings 복원 (chunk_id → "cNNN")
  const { data: chunkRows } = await db
    .from("chunks")
    .select("id, idx")
    .eq("session_id", job.session_id);
  const idxByChunkId = new Map((chunkRows ?? []).map((c) => [c.id, c.idx]));
  const { data: findingRows } = await db
    .from("findings")
    .select("chunk_id, stage, summary, quote, confidence")
    .eq("session_id", job.session_id);
  const findings: TaggedFinding[] = (findingRows ?? []).map((f) => ({
    chunkId: `c${String(idxByChunkId.get(f.chunk_id) ?? 0).padStart(3, "0")}`,
    stage: f.stage as TaggedFinding["stage"],
    summary: f.summary,
    quote: f.quote as TaggedFinding["quote"],
    confidence: f.confidence,
  }));

  const { data: projectRow } = await db
    .from("sessions")
    .select("projects(name)")
    .eq("id", job.session_id)
    .single();
  const title =
    (projectRow?.projects as unknown as { name: string } | null)?.name ??
    "세션 분석";
  const slug = slugify(title, job.session_id);

  // 마스킹은 발행 직전, view 전체에 (정규식 1차 — LLM 2차는 P4 후속)
  const view = maskDeep(
    buildPortfolioView(session, findings, {
      slug,
      title,
      ...(repoUrl ? { repoUrl } : {}),
    }),
  );

  // 세션당 포트폴리오 1개. 새로 만들면 **초안(published_at=null)** — 공개는
  // 검수 확정(/api/sessions/[id]/confirm)이 한다. 이미 공개된 포트폴리오를
  // 다시 발행하면 내용만 갱신하고 공개 상태는 유지한다.
  const { data: existing } = await db
    .from("portfolios")
    .select("id")
    .eq("session_id", job.session_id)
    .maybeSingle();
  if (existing) {
    const { error } = await db
      .from("portfolios")
      .update({ slug, title, view: JSON.parse(JSON.stringify(view)) })
      .eq("id", existing.id);
    if (error) throw new Error(`portfolio update failed: ${error.message}`);
  } else {
    const { error } = await db.from("portfolios").insert({
      session_id: job.session_id,
      slug,
      title,
      view: JSON.parse(JSON.stringify(view)),
      published_at: null,
    });
    if (error) throw new Error(`portfolio insert failed: ${error.message}`);
  }

  await db.from("jobs").update({ status: "done", progress: 100 }).eq("id", job.id);
  return { status: "done", progress: 100, continue: false };
}
