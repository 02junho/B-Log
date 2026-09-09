import type { BLogSession } from "./schema";

/** Feeds PortfolioView.stats (TEAM_PLAN §3.3) and the CLI's content-free report. */
export interface SessionStats {
  events: number;
  byRole: { user: number; assistant: number; tool: number };
  toolCalls: number;
  toolErrors: number;
  commits: number;
  filesChanged: number;
  tools: string[];
  durationMin?: number;
}

export function sessionStats(session: BLogSession): SessionStats {
  const byRole = { user: 0, assistant: 0, tool: 0 };
  const tools = new Set<string>();
  const files = new Set<string>();
  let toolCalls = 0;
  let toolErrors = 0;
  let commits = 0;
  // Tracked as running bounds: a long session would overflow the argument
  // limit of Math.min(...times), and long sessions are the point here.
  let first: number | undefined;
  let last: number | undefined;

  for (const event of session.events) {
    byRole[event.role]++;
    for (const call of event.toolCalls ?? []) {
      toolCalls++;
      tools.add(call.name);
    }
    toolErrors += (event.toolResults ?? []).filter((result) => result.isError).length;
    for (const file of event.filesChanged ?? []) files.add(file);
    if (event.gitCommit) commits++;
    if (event.ts) {
      const time = Date.parse(event.ts);
      if (!Number.isNaN(time)) {
        if (first === undefined || time < first) first = time;
        if (last === undefined || time > last) last = time;
      }
    }
  }

  const durationMin =
    first !== undefined && last !== undefined ? Math.round((last - first) / 60000) : undefined;

  return {
    events: session.events.length,
    byRole,
    toolCalls,
    toolErrors,
    commits,
    filesChanged: files.size,
    tools: [...tools].sort(),
    ...(durationMin !== undefined ? { durationMin } : {}),
  };
}
