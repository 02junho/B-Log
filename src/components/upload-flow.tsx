"use client";

/** 업로드 → 분석 → 검수. 인증은 서버에서 검증하는 로그인 쿠키를 사용한다. */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  JobRunResponse,
  PublishResponse,
  UploadResponse,
} from "@/lib/api/types";

type Phase =
  | { kind: "idle" }
  | { kind: "working"; step: string; progress: number }
  | { kind: "failed"; message: string }
  | { kind: "published"; reviewPath: string };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    throw new Error("로그인이 만료됐습니다. 다시 로그인한 뒤 시도해주세요.");
  }
  const body = (await res.json().catch(() => null)) as
    (T & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new Error(body?.error ?? `요청 실패 (${res.status})`);
  }
  return body;
}

export function UploadFlow() {
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const aborted = useRef(false);
  const running = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem("blog-access-code");
    } catch {
      /* Storage may be disabled. */
    }
    return () => {
      aborted.current = true;
    };
  }, []);

  const run = useCallback(async () => {
    if (!file || running.current) return;
    aborted.current = false;
    running.current = true;
    try {
      setPhase({ kind: "working", step: "로그 업로드 중", progress: 5 });
      const form = new FormData();
      form.append("file", file);
      if (repoUrl.trim()) form.append("repoUrl", repoUrl.trim());
      form.append("projectName", file.name.replace(/\.jsonl$/i, ""));
      const up = await api<UploadResponse>("/api/upload", {
        method: "POST",
        body: form,
      });

      setPhase({ kind: "working", step: "로그 파싱·청킹 중", progress: 15 });
      const parsed = await api<JobRunResponse>(`/api/jobs/${up.jobId}/run`, {
        method: "POST",
      });
      if (parsed.status === "failed" || !parsed.nextJobId) {
        throw new Error(parsed.error ?? "파싱에 실패했습니다.");
      }

      // 태깅: 배치가 남아 있는 동안 반복 실행. 진행률은 서버 값을 그대로 쓴다.
      let tag: JobRunResponse;
      do {
        if (aborted.current) return;
        tag = await api<JobRunResponse>(`/api/jobs/${parsed.nextJobId}/run`, {
          method: "POST",
        });
        if (tag.status === "failed") {
          throw new Error(tag.error ?? "태깅에 실패했습니다.");
        }
        setPhase({
          kind: "working",
          step: "4단계 태깅 중 (AI 분석)",
          progress: 20 + Math.round((tag.progress / 100) * 60),
        });
      } while (tag.continue);

      setPhase({
        kind: "working",
        step: "커밋 매칭·마스킹·초안 조립 중",
        progress: 90,
      });
      const published = await api<PublishResponse>(
        `/api/sessions/${up.sessionId}/publish`,
        { method: "POST" },
      );
      setPhase({ kind: "published", reviewPath: published.reviewPath });
    } catch (err) {
      setPhase({
        kind: "failed",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    } finally {
      running.current = false;
    }
  }, [file, repoUrl]);

  if (phase.kind === "published") {
    return (
      <section className="upload-card" aria-live="polite">
        <span className="eyebrow">분석 완료</span>
        <h2>검수 후 발행하면 공개됩니다.</h2>
        <p>
          마스킹이 적용된 초안이 준비됐습니다. 아직 공개 전이니, 내용을 확인하고
          발행을 확정하세요.
        </p>
        <a className="button button-dark" href={phase.reviewPath}>
          검수하러 가기 <span aria-hidden="true">↗</span>
        </a>
      </section>
    );
  }

  return (
    <section className="upload-card">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label
          className={`drop-zone${dragOver ? " drop-zone-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
        >
          <input
            type="file"
            accept=".jsonl,application/jsonl,application/x-ndjson"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <strong>{file.name}</strong>
          ) : (
            <span>
              세션 로그(.jsonl)를 끌어다 놓거나 클릭해서 선택
              <small>
                Claude Code: ~/.claude/projects/&lt;프로젝트&gt;/ · Codex:
                ~/.codex/sessions/
              </small>
            </span>
          )}
        </label>

        <label className="field">
          GitHub 공개 레포 URL <em>(선택 — 커밋과 대화를 연결합니다)</em>
          <input
            type="url"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </label>

        {phase.kind === "failed" && (
          <p role="alert" className="upload-error">
            {phase.message}
            {phase.message.startsWith("로그인이") && (
              <>
                {" "}
                <a href="/login?next=%2Fnew">로그인 확인</a>
              </>
            )}
          </p>
        )}

        {phase.kind === "working" ? (
          <div aria-live="polite" className="upload-progress">
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${phase.progress}%` }}
              />
            </div>
            <p>
              {phase.step}… {phase.progress}%
            </p>
            <small>긴 세션은 몇 분 걸릴 수 있습니다. 창을 닫지 마세요.</small>
          </div>
        ) : (
          <button type="submit" className="button button-dark" disabled={!file}>
            분석 시작
          </button>
        )}
      </form>
    </section>
  );
}
