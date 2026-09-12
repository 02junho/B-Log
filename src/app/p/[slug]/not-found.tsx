import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="state-page">
        <span className="eyebrow">404 / 기록을 찾을 수 없습니다</span>
        <h1>공개된 기록을 찾지 못했어요.</h1>
        <p>주소를 다시 확인하거나, 예시 포트폴리오를 살펴보세요.</p>
        <Link className="button button-dark" href="/p/sample-login-fix">
          예시 포트폴리오 보기 ↗
        </Link>
      </main>
    </>
  );
}
