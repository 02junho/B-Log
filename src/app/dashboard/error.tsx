"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="state-page">
      <span className="eyebrow">DASHBOARD ERROR</span>
      <h1>작업공간을 불러오지 못했습니다.</h1>
      <p>잠시 후 다시 시도해주세요. 기존 포트폴리오는 공개 링크에서 계속 볼 수 있습니다.</p>
      <div className="state-actions">
        <button className="button button-dark" onClick={reset}>다시 시도</button>
        <Link className="button" href="/">홈으로</Link>
      </div>
    </main>
  );
}
