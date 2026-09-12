"use client";

/** 검수 화면의 발행 확정 바. 액세스 코드는 업로드 화면과 같은 키를 재사용한다. */
import { useState } from "react";
import type { ConfirmResponse } from "@/lib/api/types";

const CODE_KEY = "blog-access-code";

export function ConfirmPublish({
  sessionId,
  publicPath,
  alreadyPublished,
}: {
  sessionId: string;
  publicPath: string;
  alreadyPublished: boolean;
}) {
  const [code, setCode] = useState(() => {
    try {
      return typeof window === "undefined"
        ? ""
        : (sessionStorage.getItem(CODE_KEY) ?? "");
    } catch {
      return "";
    }
  });
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string }
  >(alreadyPublished ? { kind: "done" } : { kind: "idle" });

  const confirm = async () => {
    setState({ kind: "busy" });
    try {
      const res = await fetch(`/api/sessions/${sessionId}/confirm`, {
        method: "POST",
        headers: { "x-blog-token": code },
      });
      if (res.status === 401) throw new Error("액세스 코드가 올바르지 않습니다.");
      const body = (await res.json().catch(() => null)) as
        | (ConfirmResponse & { error?: string })
        | null;
      if (!res.ok || !body) throw new Error(body?.error ?? `요청 실패 (${res.status})`);
      setState({ kind: "done" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
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
      <input
        type="password"
        autoComplete="off"
        placeholder="액세스 코드"
        aria-label="액세스 코드"
        suppressHydrationWarning
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button
        type="button"
        className="button button-dark"
        disabled={!code || state.kind === "busy"}
        onClick={() => void confirm()}
      >
        {state.kind === "busy" ? "발행 중…" : "이대로 발행 확정"}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="upload-error">
          {state.message}
        </p>
      )}
    </div>
  );
}
