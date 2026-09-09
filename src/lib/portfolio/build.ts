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

export function buildPortfolioView(
  session: BLogSession,
  findings: readonly TaggedFinding[],
  meta: { slug: string; title: string; repoUrl?: string },
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
  const timeline = [...findings]
    .sort((a, b) => a.quote.eventId.localeCompare(b.quote.eventId))
    .map((f) => {
      const ev = events.get(f.quote.eventId);
      const commit = ev?.gitCommit?.sha
        ? {
            sha: ev.gitCommit.sha,
            message: ev.gitCommit.message,
            url: commitUrl(meta.repoUrl, ev.gitCommit.sha),
          }
        : undefined;
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
      commits: stats.commits,
      ...(stats.durationMin !== undefined
        ? { durationMin: stats.durationMin }
        : {}),
      byRole: stats.byRole,
    },
  };
}
