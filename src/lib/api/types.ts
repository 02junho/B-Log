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

/** POST /api/sessions/[id]/publish — match → publish(초안 조립)를 순서대로 실행.
 * 공개는 confirm이 확정한다. */
export interface PublishResponse {
  sessionId: string;
  slug: string;
  /** 공개 페이지 경로 (검수 확정 후에만 열림). */
  path: string;
  /** 검수 화면 경로 — 업로드 플로우는 여기로 보낸다. */
  reviewPath: string;
  matchJobId: string;
  publishJobId: string;
}

/** POST /api/sessions/[id]/confirm — 검수 확정: 초안을 공개로 전환. */
export interface ConfirmResponse {
  sessionId: string;
  slug: string;
  path: string;
  publishedAt: string;
}

export interface ApiError {
  error: string;
}
