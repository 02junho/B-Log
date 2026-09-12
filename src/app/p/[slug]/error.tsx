"use client";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="state-page">
        <span className="eyebrow">잠시 연결을 쉬어가는 중</span>
        <h1>기록을 불러오지 못했어요.</h1>
        <p>잠시 후 다시 시도해주세요.</p>
        <div>
          <button className="button button-dark" onClick={retry}>
            다시 불러오기
          </button>
          <Link className="button button-light" href="/">
            홈으로
          </Link>
        </div>
      </main>
    </>
  );
}
