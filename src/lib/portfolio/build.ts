/**
 * PortfolioView builder (Step 6, P1 → P2가 발행 시 호출).
 *
 * 정규화 세션 + 검증된 findings → 공개 페이지 데이터. 전부 결정적(LLM 없음):
 * LLM 산출물은 findings까지고, 그 뒤 선별·조립은 코드가 한다. 하이라이트는
 * confidence 순으로 뽑되 단계 다양성을 우선한다(같은 단계만 5개보다 4단계가
 * 고루 보이는 쪽이 "지휘 과정"을 증명한다).
 */
import type { BLogEvent, BLogSession } from "../parser/schema";
import { sessionStats } from "../parser/stats";
import type { TaggedFinding } from "../pipeline/tag";
import { STAGES, type PortfolioView, type Stage } from "./view";

const TOOL_LABELS: Record<BLogSession["source"]["tool"], string> = {
  "claude-code": "Claude Code",
  codex: "OpenAI Codex",
  transcript: "대화록",
};

const HIGHLIGHT_COUNT = 5;

function eventById(session: BLogSession): Map<string, BLogEvent> {
  return new Map(session.events.map((e) => [e.id, e]));
}

/** repoUrl이 있으면 커밋 링크를 만든다 (공개 레포 가정). */
function commitUrl(repoUrl: string | undefined, sha: string): string {
  if (!repoUrl) return "";
  return `${repoUrl.replace(/\/$/, "").replace(/\.git$/, "")}/commit/${sha}`;
}

export function selectHighlights(
  findings: readonly TaggedFinding[],
  count = HIGHLIGHT_COUNT,
): TaggedFinding[] {
  const byConfidence = [...findings].sort((a, b) => b.confidence - a.confidence);
  const picked: TaggedFinding[] = [];
  // 1라운드: 단계별 최고 confidence 하나씩 (단계 다양성 우선).
  for (const stage of STAGES) {
    const best = byConfidence.find((f) => f.stage === stage);
    if (best && picked.length < count) picked.push(best);
  }
  // 2라운드: 남은 자리를 confidence 순으로.
  for (const f of byConfidence) {
    if (picked.length >= count) break;
    if (!picked.includes(f)) picked.push(f);
  }
  return picked;
}

/** 매칭 잡(matches 테이블)이 찾아준 finding별 최적 커밋. findings와 같은 인덱스. */
export interface MatchedCommit {
  sha: string;
  message: string;
  method: "log" | "time" | "embed";
}

export function buildPortfolioView(
  session: BLogSession,
  findings: readonly TaggedFinding[],
  meta: {
    slug: string;
    title: string;
    repoUrl?: string;
    /** findings[i]에 대응하는 매칭 커밋 (없으면 undefined). */
    matchedCommits?: readonly (MatchedCommit | undefined)[];
  },
): PortfolioView {
  const stats = sessionStats(session);
  const events = eventById(session);

  // 단계별 요약: 그 단계 findings 중 confidence 최상위의 summary.
  const summary = Object.fromEntries(
    STAGES.map((stage) => {
      const best = [...findings]
        .filter((f) => f.stage === stage)
        .sort((a, b) => b.confidence - a.confidence)[0];
      return [stage, best?.summary ?? ""];
    }),
  ) as Record<Stage, string>;

  // 타임라인: 이벤트 순서(= id 순번)대로. 인용 이벤트의 ts·커밋을 붙인다.
  // 커밋 우선순위: ①이벤트에서 git이 직접 확인한 커밋(method: "log")
  // ②매칭 잡이 찾아준 커밋(method는 매칭 방법 그대로 — 추정을 확정처럼 안 꾸민다).
  const linkedShas = new Set<string>();
  const timeline = findings
    .map((f, i) => ({ f, matched: meta.matchedCommits?.[i] }))
    .sort((a, b) => a.f.quote.eventId.localeCompare(b.f.quote.eventId))
    .map(({ f, matched }) => {
      const ev = events.get(f.quote.eventId);
      const commit = ev?.gitCommit?.sha
        ? {
            sha: ev.gitCommit.sha,
            message: ev.gitCommit.message,
            url: commitUrl(meta.repoUrl, ev.gitCommit.sha),
            method: "log" as const,
          }
        : matched
          ? {
              sha: matched.sha,
              message: matched.message,
              url: commitUrl(meta.repoUrl, matched.sha),
              method: matched.method,
            }
          : undefined;
      if (commit) linkedShas.add(commit.sha);
      return {
        ...(ev?.ts ? { ts: ev.ts } : {}),
        stage: f.stage,
        summary: f.summary,
        quote: f.quote.text,
        ...(commit ? { commit } : {}),
      };
    });

  const highlights = selectHighlights(findings).map((f) => ({
    stage: f.stage,
    title: f.summary,
    quote: f.quote.text,
    why: `세션 원문에서 그대로 확인된 인용 (${f.quote.eventId}, 신뢰도 ${Math.round(f.confidence * 100)}%)`,
  }));

  return {
    slug: meta.slug,
    title: meta.title,
    tools: [TOOL_LABELS[session.source.tool], ...stats.tools].filter(Boolean),
    fidelity: session.source.fidelity,
    summary,
    timeline,
    highlights,
    stats: {
      events: stats.events,
      toolCalls: stats.toolCalls,
      // 화면의 "연결된 커밋" = 타임라인에 실제로 연결된 서로 다른 커밋 수.
      // 타임라인에 연결된 게 없으면 로그에서 확인된 커밋 수로 폴백.
      commits: linkedShas.size > 0 ? linkedShas.size : stats.commits,
      ...(stats.durationMin !== undefined
        ? { durationMin: stats.durationMin }
        : {}),
      byRole: stats.byRole,
    },
  };
}
