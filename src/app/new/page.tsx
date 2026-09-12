import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { UploadFlow } from "@/components/upload-flow";

export const metadata: Metadata = {
  title: "로그 분석하기 | B-Log",
  description: "AI 코딩 세션 로그를 올리면 과정 포트폴리오를 만들어 드립니다.",
  robots: { index: false, follow: false },
};

export default function NewSessionPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="upload-page">
        <span className="eyebrow">ANALYZE YOUR LOG</span>
        <h1>내 로그 분석하기</h1>
        <p className="upload-lede">
          Claude Code 또는 Codex 세션 로그(.jsonl)를 올리면
          문제 정의 → AI 지시 → 근거 탐색 → 실패·복구의 과정을 추출합니다.
          업로드한 원본은 공개되지 않으며, 발행 전에 마스킹이 적용됩니다.
        </p>
        <UploadFlow />
      </main>
    </>
  );
}
