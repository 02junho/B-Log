import Link from "next/link";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="B-Log 홈">
          <span className="brand-mark">
            b<span>·</span>
          </span>
          B-Log<span className="brand-caption">BUILD WITH INTENT</span>
        </Link>
        <nav aria-label="주 메뉴">
          <Link href="/p/sample-login-fix">
            포트폴리오 둘러보기 <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/new">내 로그 분석하기</Link>
        </nav>
      </div>
    </header>
  );
}
