"use client";

/** 검수 화면의 발행 확정 바. 소유자 인증은 서버가 로그인 쿠키로 검증한다. */
import { useEffect, useRef, useState } from "react";
import type { ConfirmResponse } from "@/lib/api/types";

export function ConfirmPublish({
  sessionId,
  publicPath,
  alreadyPublished,
}: {
  sessionId: string;
  publicPath: string;
  alreadyPublished: boolean;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "busy" }
    | { kind: "done" }
    | { kind: "error"; message: string }
  >(alreadyPublished ? { kind: "done" } : { kind: "idle" });
  const [reviewed, setReviewed] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    try {
      sessionStorage.removeItem("blog-access-code");
    } catch {
      /* Storage may be disabled. */
    }
  }, []);

  const confirm = async () => {
    if (!reviewed || submitting.current || state.kind === "done") return;
    submitting.current = true;
    setState({ kind: "busy" });
    try {
      const res = await fetch(`/api/sessions/${sessionId}/confirm`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.status === 401)
        throw new Error(
          "로그인이 만료됐습니다. 다시 로그인한 뒤 시도해주세요.",
        );
      const body = (await res.json().catch(() => null)) as
        (ConfirmResponse & { error?: string }) | null;
      if (!res.ok || !body)
        throw new Error(body?.error ?? `요청 실패 (${res.status})`);
      setState({ kind: "done" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    } finally {
      submitting.current = false;
    }
  };

  if (state.kind === "done") {
    return (
      <div className="confirm-bar" role="status">
        <span>공개됐습니다.</span>
        <a className="button button-dark" href={publicPath}>
          공개 페이지 열기 <span aria-hidden="true">↗</span>
        </a>
      </div>
    );
  }

  return (
    <div className="confirm-bar">
      <label className="review-consent">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={state.kind === "busy"}
          onChange={(event) => setReviewed(event.target.checked)}
        />
        공개될 인용·요약·커밋을 확인했고, 개인정보나 공개하면 안 되는 내용이
        없는지 검토했습니다.
      </label>
      <button
        type="button"
        className="button button-dark"
        disabled={!reviewed || state.kind === "busy"}
        onClick={() => void confirm()}
      >
        {state.kind === "busy" ? "발행 중…" : "이대로 발행 확정"}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="upload-error">
          {state.message}
          {state.message.startsWith("로그인이") && (
            <>
              {" "}
              <a
                href={`/login?next=${encodeURIComponent(`/sessions/${sessionId}/review`)}`}
              >
                로그인 확인
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
