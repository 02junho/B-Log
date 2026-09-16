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
    /** url은 repoUrl을 모르면 빈 문자열 — P3는 url이 있을 때만 링크를 건다.
     * method: 이 커밋이 어떻게 연결됐는지. "log" = git이 로그에서 직접 확인
     * (정확), "time" = 타임스탬프 근접 추정, "embed" = 임베딩 유사도(미사용).
     * 추정을 확정처럼 보이지 않게 P3는 log가 아니면 배지로 구분 표시한다. */
    commit?: {
      sha: string;
      message: string;
      url: string;
      method?: "log" | "time" | "embed";
    };
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
    /** 타임라인에 연결된 서로 다른 커밋 수 (로그 확인 + 매칭 추정 합산). */
    commits: number;
    durationMin?: number;
    /** "AI 기여/인간 개입" 요약의 재료 (ROADMAP Step 7 화면 요구사항). */
    byRole: { user: number; assistant: number; tool: number };
  };
  /**
   * 이 view에 적용된 마스킹의 상태. 발행 잡이 채운다.
   *
   * 없으면 = 마스킹 2차가 생기기 전에 만들어진 초안이다. 검수 화면은 없는 것과
   * level: "regex-only"를 똑같이 경고로 취급해야 한다 — 사람이 무엇을 믿고
   * 보는지 알아야 눈검사가 의미를 갖는다.
   *
   * 가려진 문자열 자체는 절대 담지 않는다. 개수만 담는다.
   */
  masking?: {
    level: "regex+llm" | "regex-only";
    /** 정규식이 치환한 총 횟수. */
    regexTotal: number;
    /** LLM 탐지로 추가로 가린 서로 다른 문자열 수. */
    llmApplied: number;
    /** 원문에 없어서 버린 후보 수 (모델이 지어낸 것). */
    llmRejected: number;
    /** level이 regex-only일 때 그 이유. */
    degradedReason?: string;
  };
}
