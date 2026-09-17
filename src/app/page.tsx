import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="landing">
        <div className="landing-copy">
          <p className="eyebrow">
            <span className="status-dot" /> YOUR PROCESS, YOUR PROOF.
          </p>
          <h1>
            결과는 보여줬으니까.
            <br />
            <span>이제, 과정을 증명하세요.</span>
          </h1>
          <p>
            어떤 질문을 했는지, 왜 방향을 바꿨는지.
            <br />
            AI와 함께 만든 기록을 나만의 과정 포트폴리오로.
          </p>
          <Link
            className="button button-dark"
            href="/p/b-log를-만든-과정-64632d"
          >
            이 서비스를 만든 과정 보기 <span aria-hidden="true">↗</span>
          </Link>
          <span className="landing-caption">
            로그인 없이 살펴보세요 · B-Log 개발 로그를 B-Log로 분석한 실제 기록
          </span>
        </div>
        <Link
          className="landing-preview"
          href="/p/b-log를-만든-과정-64632d"
          aria-label="B-Log를 만든 과정 — 메타 포트폴리오 보기"
        >
          <div className="preview-top">
            <span className="brand-mark">
              b<span>·</span>
            </span>
            <span>BUILD STORY / 01</span>
            <span>↗</span>
          </div>
          <div className="preview-body">
            <span className="fidelity">✦ 정밀 분석 · 실제 기록</span>
            <h2>
              B-Log를 만든 과정,
              <br />
              B-Log가 직접 분석하다
            </h2>
            <div className="preview-flow">
              {[
                "문제를 좁히고",
                "방향을 정하고",
                "근거로 결정하고",
                "실패에서 복구하다",
              ].map((label, i) => (
                <div key={label}>
                  <b>0{i + 1}</b>
                  <span>{label}</span>
                  <span>↗</span>
                </div>
              ))}
            </div>
            <p>10일의 개발 · 연결된 커밋 29개 · 하나의 과정</p>
          </div>
        </Link>
      </main>
      <section className="landing-demos" aria-label="데모 포트폴리오 모음">
        <div className="landing-demos-inner">
          <p className="eyebrow">SEE THE DIFFERENCE</p>
          <h2>같은 도구, 다른 지휘. 기록이 증명합니다.</h2>
          <div className="demo-cards">
            <Link href="/p/b-log를-만든-과정-64632d" className="demo-card">
              <span className="demo-tag good">실제 기록 · 메타 데모</span>
              <h3>B-Log를 만든 과정</h3>
              <p>
                이 서비스의 개발 로그 10일치를 서비스 자신이 분석했습니다.
                159개의 검증된 순간과 29개의 커밋 연결.
              </p>
              <span className="demo-cta">보러 가기 ↗</span>
            </Link>
            <Link
              href="/p/쇼핑몰-하루-만에-ai에-통째로-맡긴-예-a4d4b4"
              className="demo-card"
            >
              <span className="demo-tag bad">반면교사 · 나쁜 예</span>
              <h3>AI에 통째로 맡긴 하루</h3>
              <p>
                요구사항도 검증도 없이 &ldquo;응 다 해줘&rdquo;로 만든 기록.
                좋은 지휘와 무엇이 다른지 비교해 보세요.
              </p>
              <span className="demo-cta">보러 가기 ↗</span>
            </Link>
            <Link href="/p/sample-login-fix" className="demo-card">
              <span className="demo-tag">화면 안내 · 합성 예시</span>
              <h3>로그인 버그를 잡은 과정</h3>
              <p>
                포트폴리오 화면 구성을 살펴볼 수 있는 짧은 합성 예시입니다.
              </p>
              <span className="demo-cta">보러 가기 ↗</span>
            </Link>
          </div>
        </div>
      </section>
      <footer className="landing-footer">
        B-Log · Build-Log <span>만든 것 너머, 만들어 온 과정까지.</span>{" "}
        <Link href="/licenses">오픈소스 라이선스</Link>
      </footer>
    </>
  );
}
