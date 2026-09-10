/**
 * API 요청·응답 타입 (TEAM_PLAN §3.4 — P2 소유, P3 소비).
 * 라우트 구현과 이 파일이 어긋나면 이 파일이 계약이다.
 */
import type { Fidelity, SourceTool } from "../parser/schema";

export type JobKind = "parse" | "tag" | "match" | "publish";
export type JobStatus = "queued" | "running" | "done" | "failed";
export type SessionStatus = "uploaded" | "processing" | "ready" | "failed";

/** POST /api/upload — multipart/form-data: file(필수), projectName?, repoUrl? */
export interface UploadResponse {
  projectId: string;
  sessionId: string;
  /** 업로드 직후 생성된 parse 잡. 이걸 run 하면 파이프라인이 시작된다. */
  jobId: string;
  sourceTool: SourceTool;
  fidelity: Fidelity;
}

/** GET /api/jobs/[id] */
export interface JobStatusResponse {
  id: string;
  sessionId: string;
  kind: JobKind;
  status: JobStatus;
  /** 0~100. */
  progress: number;
  error?: string;
  /** 이 잡이 끝나며 만든 다음 잡 (parse → tag). */
  nextJobId?: string;
  sessionStatus: SessionStatus;
}

/** POST /api/jobs/[id]/run — 본문 없음. 시간 상한 안에서 한 배치 처리. */
export interface JobRunResponse {
  id: string;
  status: JobStatus;
  progress: number;
  /** true면 아직 남았다 — 클라이언트(또는 폴링 루프)가 run을 다시 호출한다. */
  continue: boolean;
  nextJobId?: string;
  error?: string;
}

export interface ApiError {
  error: string;
}
