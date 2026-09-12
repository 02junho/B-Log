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
          <Link className="button button-dark" href="/p/sample-login-fix">
            예시 포트폴리오 둘러보기 <span aria-hidden="true">↗</span>
          </Link>
          <span className="landing-caption">
            로그인 없이 살펴보세요 · 합성 데모
          </span>
        </div>
        <Link
          className="landing-preview"
          href="/p/sample-login-fix"
          aria-label="로그인 세션 만료 버그 데모 보기"
        >
          <div className="preview-top">
            <span className="brand-mark">
              b<span>·</span>
            </span>
            <span>BUILD STORY / 01</span>
            <span>↗</span>
          </div>
          <div className="preview-body">
            <span className="fidelity">✦ 정밀 분석</span>
            <h2>
              로그인 세션 만료 버그를
              <br />
              AI와 함께 잡은 과정
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
            <p>29분의 작업 · 2개의 커밋 · 하나의 과정</p>
          </div>
        </Link>
      </main>
      <footer className="landing-footer">
        B-Log · Build-Log <span>만든 것 너머, 만들어 온 과정까지.</span>
      </footer>
    </>
  );
}
