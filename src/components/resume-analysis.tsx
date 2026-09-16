"use client";

import { useState } from "react";
import type { JobRunResponse, PublishResponse, SessionStatus } from "@/lib/api/types";

type State =
  | { kind: "idle" }
  | { kind: "working"; message: string; progress: number }
  | { kind: "failed"; message: string }
  | { kind: "done"; reviewPath: string };

async function post<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin" });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `요청 실패 (${response.status})`);
  return body;
}

export function ResumeAnalysis({
  sessionId,
  sessionStatus,
  jobId,
}: {
  sessionId: string;
  sessionStatus: SessionStatus;
  jobId: string | null;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function resume() {
    if (state.kind === "working") return;
    try {
      let currentJobId = jobId;
      if (sessionStatus !== "ready") {
        if (!currentJobId) throw new Error("이어갈 분석 작업을 찾지 못했습니다.");
        while (currentJobId) {
          setState({ kind: "working", message: "분석 작업을 이어가는 중", progress: 20 });
          const result: JobRunResponse = await post<JobRunResponse>(`/api/jobs/${currentJobId}/run`);
          if (result.status === "failed") throw new Error(result.error ?? "분석에 실패했습니다.");
          setState({ kind: "working", message: "4단계 분석을 이어가는 중", progress: 20 + Math.round(result.progress * 0.65) });
          if (result.nextJobId) {
            currentJobId = result.nextJobId;
          } else if (result.continue) {
            currentJobId = result.id;
          } else {
            currentJobId = null;
          }
        }
      }
      setState({ kind: "working", message: "검수용 초안을 만드는 중", progress: 92 });
      const published = await post<PublishResponse>(`/api/sessions/${sessionId}/publish`);
      setState({ kind: "done", reviewPath: published.reviewPath });
    } catch (error) {
      setState({ kind: "failed", message: error instanceof Error ? error.message : "분석을 이어가지 못했습니다." });
    }
  }

  if (state.kind === "done") {
    return <a className="button button-dark" href={state.reviewPath}>검수하러 가기 <span aria-hidden="true">→</span></a>;
  }
  return (
    <div className="resume-actions">
      {state.kind === "working" && (
        <div className="upload-progress" aria-live="polite">
          <div className="progress-track"><div className="progress-bar" style={{ width: `${state.progress}%` }} /></div>
          <p>{state.message}… {state.progress}%</p>
          <small>이 화면을 열어둔 상태에서 완료까지 기다려주세요.</small>
        </div>
      )}
      {state.kind === "failed" && <p className="upload-error" role="alert">{state.message}</p>}
      {state.kind !== "working" && (
        <button className="button button-dark" type="button" onClick={() => void resume()}>
          {state.kind === "failed" ? "다시 시도" : sessionStatus === "ready" ? "검수용 초안 만들기" : "분석 이어가기"}
        </button>
      )}
    </div>
  );
}
