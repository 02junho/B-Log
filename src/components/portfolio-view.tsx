"use client";

import { useState } from "react";
import Link from "next/link";
import {
  STAGES,
  type PortfolioView as Portfolio,
  type Stage,
} from "@/lib/portfolio/view";
import {
  STAGE_LABELS,
  displayTime,
  displayDuration,
  safeCommitUrl,
} from "@/lib/portfolio/presentation";

export function PortfolioView({
  view,
  demo = false,
}: {
  view: Portfolio;
  demo?: boolean;
}) {
  const [filter, setFilter] = useState<Stage | "all">("all");
  const [shareStatus, setShareStatus] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const rows = view.timeline
    .map((item, index) => ({ ...item, index }))
    .filter((item) => filter === "all" || item.stage === filter);
  const total =
    view.stats.byRole.user +
    view.stats.byRole.assistant +
    view.stats.byRole.tool;
  async function share() {
    const url = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("링크를 복사했어요.");
      setShareUrl("");
    } catch {
      setShareUrl(url);
      setShareStatus("아래 주소를 선택해 복사해주세요.");
    }
  }
  return (
    <main id="main-content" className="portfolio-shell">
      <div className="breadcrumb">
        <Link href="/">홈</Link>
        <span>/</span>
        <span>과정 포트폴리오</span>
      </div>
      {demo && (
        <div className="demo-notice">
          <span className="status-dot" />
          데모 포트폴리오{" "}
          <span>
            화면을 살펴볼 수 있도록 만든 합성 예시입니다. 실제 프로젝트 기록이
            아닙니다.
          </span>
        </div>
      )}
      <section className="portfolio-hero" aria-labelledby="portfolio-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-line" /> A BUILD STORY{" "}
            <span className="edition">과정 포트폴리오</span>
          </div>
          <h1 id="portfolio-title">{view.title}</h1>
          <p className="hero-description">
            무엇을 만들었는지 너머,
            <br className="mobile-break" /> 어떻게 생각하고 AI를 지휘했는지.
          </p>
          <div className="hero-tags">
            <span className={`fidelity ${view.fidelity}`}>
              <span aria-hidden="true">✦</span>{" "}
              {view.fidelity === "structured" ? "정밀 분석" : "요약 분석"}
            </span>
            {view.tools.slice(0, 5).map((tool, i) => (
              <span className="tool-tag" key={`${tool}-${i}`}>
                {tool}
              </span>
            ))}
            {view.tools.length > 5 && (
              <span className="tool-tag">외 {view.tools.length - 5}개</span>
            )}
          </div>
        </div>
        <div className="hero-actions">
          <button className="button button-dark" onClick={share}>
            <span aria-hidden="true">↗</span> 링크 공유하기
          </button>
          <p aria-live="polite" className="share-status">
            {shareStatus || "하나의 링크로 전달하는 나의 작업 과정"}
          </p>
          {shareUrl && (
            <input
              className="share-input"
              aria-label="공유할 포트폴리오 주소"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          )}
        </div>
      </section>

      <section className="stats-strip" aria-label="세션 통계">
        {[
          {
            label: "기록된 이벤트",
            value: view.stats.events,
            unit: "개",
            detail: "대화와 도구 실행 기록",
          },
          {
            label: "도구 호출",
            value: view.stats.toolCalls,
            unit: "회",
            detail: "탐색부터 수정, 검증까지",
          },
          {
            label: "연결된 커밋",
            value: view.stats.commits,
            unit: "개",
            detail: "과정이 결과로 남은 순간",
          },
          {
            label: "세션 소요 시간",
            value: displayDuration(view.stats.durationMin),
            unit: "",
            detail: "로그에 기록된 시간 기준",
          },
        ].map((stat, i) => (
          <div className="stat" key={stat.label}>
            <span className="stat-label">
              <span className="stat-index">0{i + 1}</span>
              {stat.label}
            </span>
            <div className="stat-value">
              {stat.value}
              <span>{stat.unit}</span>
            </div>
            <span className="stat-detail">{stat.detail}</span>
          </div>
        ))}
      </section>

      <nav className="section-nav" aria-label="포트폴리오 목차">
        <a href="#overview">과정 한눈에 보기</a>
        <a href="#highlights">
          주요 장면 <span>{view.highlights.length}</span>
        </a>
        <a href="#journey">
          작업 타임라인 <span>{view.timeline.length}</span>
        </a>
        <span className="nav-note">FROM PROMPT TO PROOF</span>
      </nav>

      <section id="overview" className="overview section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE BIG PICTURE</p>
            <h2>좋은 결과에는, 좋은 과정이 있습니다.</h2>
          </div>
          <p>네 가지 관점으로 읽는 이번 작업</p>
        </div>
        <div className="stage-grid">
          {STAGES.map((stage, index) => (
            <article className={`stage-card stage-${stage}`} key={stage}>
              <div className="stage-card-top">
                <span className="step-number">0{index + 1}</span>
                <span className="stage-symbol" aria-hidden="true">
                  {["◎", "↗", "◇", "↺"][index]}
                </span>
              </div>
              <h3>{STAGE_LABELS[stage]}</h3>
              <p>{view.summary[stage] || "이 단계의 기록은 아직 없습니다."}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="content-columns">
        <div className="story-column">
          <section id="highlights" className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">MOMENTS THAT MATTER</p>
                <h2>결과를 바꾼 주요 장면</h2>
              </div>
              <span className="count-label">
                {view.highlights.length} SCENES
              </span>
            </div>
            <p className="section-description">
              방향을 정하고, 근거를 찾고, 다시 시도한 순간들.
            </p>
            <div className="highlight-list">
              {view.highlights.length ? (
                view.highlights.map((item, index) => (
                  <article
                    className={`highlight stage-${item.stage}`}
                    key={index}
                  >
                    <div className="highlight-top">
                      <span className="stage-pill">
                        {STAGE_LABELS[item.stage]}
                      </span>
                      <span className="scene-number">
                        SCENE {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <blockquote>
                      <span aria-hidden="true" className="quote-mark">
                        “
                      </span>
                      {item.quote}
                    </blockquote>
                    <details>
                      <summary>
                        이 장면의 선정 근거 <span aria-hidden="true">＋</span>
                      </summary>
                      <p>{item.why}</p>
                    </details>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  아직 선정된 주요 장면이 없습니다.
                </div>
              )}
            </div>
          </section>
          <section id="journey" className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE BUILD JOURNEY</p>
                <h2>한 단계씩 쌓아 올린 기록</h2>
              </div>
              <span className="count-label">KST · 한국 시간</span>
            </div>
            <div className="filters" aria-label="타임라인 단계 필터">
              {(["all", ...STAGES] as const).map((stage) => (
                <button
                  key={stage}
                  aria-pressed={filter === stage}
                  className={filter === stage ? "selected" : ""}
                  onClick={() => setFilter(stage)}
                >
                  {stage === "all" ? "전체" : STAGE_LABELS[stage]}{" "}
                  <span>
                    {stage === "all"
                      ? view.timeline.length
                      : view.timeline.filter((item) => item.stage === stage)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <p className="sr-only" role="status">
              {rows.length}개의 기록
            </p>
            <ol className="timeline">
              {rows.map((item) => {
                const url =
                  !demo && item.commit
                    ? safeCommitUrl(item.commit.url)
                    : undefined;
                return (
                  <li
                    className={`timeline-item stage-${item.stage}`}
                    key={item.index}
                  >
                    <div className="time-rail">
                      <span className="timeline-dot" />
                      {item.ts && !Number.isNaN(Date.parse(item.ts)) ? (
                        <time dateTime={item.ts}>{displayTime(item.ts)}</time>
                      ) : (
                        <span>시간 미기록</span>
                      )}
                    </div>
                    <article>
                      <span className="stage-pill">
                        {STAGE_LABELS[item.stage]}
                      </span>
                      <h3>{item.summary}</h3>
                      {item.quote && <blockquote>{item.quote}</blockquote>}
                      {item.commit && (
                        <div className="commit-reference">
                          <span aria-hidden="true">⑂</span>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.commit.sha.slice(0, 7)}{" "}
                              <span aria-hidden="true">↗</span>
                              <span className="sr-only">
                                {" "}
                                GitHub 커밋, 새 탭
                              </span>
                            </a>
                          ) : (
                            <code>{item.commit.sha.slice(0, 7)}</code>
                          )}
                          <span>{item.commit.message}</span>
                          {demo && <small>예시 커밋</small>}
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
            {!rows.length && (
              <div className="empty-state">
                이 단계에 해당하는 기록이 없습니다.
                <br />
                <button
                  className="text-button"
                  onClick={() => setFilter("all")}
                >
                  전체 기록 보기 →
                </button>
              </div>
            )}
          </section>
        </div>
        <aside className="story-sidebar" aria-label="기록 안내">
          <div className="sidebar-card participation">
            <p className="eyebrow">HUMAN × AI</p>
            <h2>함께 만든 과정</h2>
            <p>
              질문과 판단, 실행이 모여
              <br />
              하나의 작업이 됩니다.
            </p>
            <div className="role-chart" aria-hidden="true">
              {total > 0 && (["user", "assistant", "tool"] as const).map((role) => (
                <span
                  key={role}
                  className={`role-${role}`}
                  style={{ flex: view.stats.byRole[role] }}
                />
              ))}
            </div>
            <dl>
              {(
                [
                  { role: "user", name: "사용자 발화" },
                  { role: "assistant", name: "AI 응답·호출" },
                  { role: "tool", name: "도구 실행 결과" },
                ] as const
              ).map(({ role, name }) => (
                <div key={role}>
                  <dt>
                    <i className={`role-${role}`} />
                    {name}
                  </dt>
                  <dd>
                    {view.stats.byRole[role]}
                    <span>개</span>
                  </dd>
                </div>
              ))}
            </dl>
            <small>
              로그 이벤트 수를 나타내며, 기여도 점수나 작업 비율을 의미하지
              않습니다.
            </small>
          </div>
          <div className="sidebar-note">
            <span className="note-icon" aria-hidden="true">
              ✳
            </span>
            <h3>
              주장은 짧게,
              <br />
              근거는 선명하게.
            </h3>
            <p>
              이 기록은 대화의 인용과 커밋을 함께 보여줍니다. 결과뿐 아니라 그
              결과에 이른 판단을 살펴보세요.
            </p>
            <span className="note-rule" />
            <span className="mini-brand">B-Log / 과정이 곧 증거</span>
          </div>
          <div className="analysis-note">
            <h3>
              {view.fidelity === "structured"
                ? "정밀 분석 기록"
                : "요약 분석 기록"}
            </h3>
            <p>
              {view.fidelity === "structured"
                ? "정형 세션 로그를 바탕으로 시간, 도구 실행과 커밋 근거를 함께 읽었습니다."
                : "대화록을 바탕으로 과정을 정리했습니다. 시간과 도구 실행 기록은 일부 없을 수 있습니다."}
            </p>
          </div>
        </aside>
      </div>
      <footer className="portfolio-footer">
        <Link className="brand" href="/">
          <span className="brand-mark">
            b<span>·</span>
          </span>
          B-Log
        </Link>
        <p>만든 것 너머, 만들어 온 과정까지.</p>
        <span>BUILD WITH INTENT.</span>
      </footer>
    </main>
  );
}
