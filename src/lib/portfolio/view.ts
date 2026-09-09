/**
 * PortfolioView — 공개 페이지 데이터 계약 (TEAM_PLAN §3.3).
 *
 * P2가 생산하고(발행 시 portfolios.view jsonb로 저장) P3가 소비한다.
 * 코드가 계약의 원본이다. 바꾸려면 PR 제목에 [계약]을 달고 저녁 싱크에서.
 */

/** 4단계 어휘 — DB findings.stage 와 동일 (TEAM_PLAN §3.2). */
export const STAGES = ["problem", "instruct", "evidence", "recovery"] as const;
export type Stage = (typeof STAGES)[number];

export interface PortfolioView {
  slug: string;
  title: string;
  /** 세션에서 실제로 쓰인 도구 라벨 (예: "Claude Code"). */
  tools: string[];
  /** 분석 등급 배지: structured = 정밀 분석, transcript = 요약 분석. */
  fidelity: "structured" | "transcript";
  /** 단계별 한 문단 요약. 해당 단계가 로그에 없으면 빈 문자열. */
  summary: Record<Stage, string>;
  timeline: {
    ts?: string;
    stage: Stage;
    summary: string;
    /** 원문 인용 (검증된 것만 — 원문에 그대로 존재). */
    quote?: string;
    /** url은 repoUrl을 모르면 빈 문자열 — P3는 url이 있을 때만 링크를 건다. */
    commit?: { sha: string; message: string; url: string };
  }[];
  highlights: {
    stage: Stage;
    title: string;
    quote: string;
    why: string;
  }[];
  stats: {
    events: number;
    toolCalls: number;
    commits: number;
    durationMin?: number;
    /** "AI 기여/인간 개입" 요약의 재료 (ROADMAP Step 7 화면 요구사항). */
    byRole: { user: number; assistant: number; tool: number };
  };
}
