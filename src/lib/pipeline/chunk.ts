/**
 * Chunking: BLogSession → tagging units (Step 4~6).
 *
 * A chunk is what one LLM tagging call sees. Boundaries follow user turns —
 * a turn is one user prompt plus everything the assistant did in response —
 * because the four stages (problem → instruction → evidence → recovery) are
 * phases of exactly that arc. Oversized turns are split, tiny ones merged.
 *
 * Rendering: every event becomes `[eventId] role: text` lines, so the model
 * can cite quotes by event id and we can verify them mechanically.
 */
import type { BLogEvent, BLogSession } from "../parser/schema";

export interface Chunk {
  id: string;
  eventIds: string[];
  /** Compact transcript the LLM sees. */
  text: string;
  startTs?: string;
  endTs?: string;
}

/** Soft cap per chunk, in characters (~3K tokens for KR/EN mix). */
const MAX_CHARS = 9000;
/** Turns shorter than this merge into the next turn. */
const MIN_CHARS = 800;
/** A single event longer than this is truncated in the rendering. */
const MAX_EVENT_CHARS = 2500;

function renderEvent(e: BLogEvent): string {
  const lines: string[] = [];
  let text = e.text.trim();
  if (text.length > MAX_EVENT_CHARS) {
    text = `${text.slice(0, MAX_EVENT_CHARS)}\n…(잘림)`;
  }
  if (text) lines.push(`[${e.id}] ${e.role}: ${text}`);
  for (const c of e.toolCalls ?? []) {
    const input =
      typeof c.input === "string" ? c.input : JSON.stringify(c.input);
    lines.push(
      `[${e.id}] tool-call ${c.name}: ${String(input).slice(0, 600)}`,
    );
  }
  for (const r of e.toolResults ?? []) {
    const head = r.isError ? "tool-error" : "tool-result";
    lines.push(`[${e.id}] ${head}: ${r.output.slice(0, 600)}`);
  }
  if (e.gitCommit) {
    lines.push(
      `[${e.id}] git-commit${e.gitCommit.sha ? ` ${e.gitCommit.sha}` : ""}: ${e.gitCommit.message}`,
    );
  }
  if (e.filesChanged?.length) {
    lines.push(`[${e.id}] files-changed: ${e.filesChanged.join(", ")}`);
  }
  return lines.join("\n");
}

/** Split events into user-turn groups (turn = user event + following events). */
function turns(events: readonly BLogEvent[]): BLogEvent[][] {
  const out: BLogEvent[][] = [];
  let current: BLogEvent[] = [];
  for (const e of events) {
    if (e.role === "user" && current.some((x) => x.role === "user")) {
      out.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length) out.push(current);
  return out;
}

export function chunkSession(session: BLogSession): Chunk[] {
  const rendered = turns(session.events).map((events) => ({
    events,
    text: events.map(renderEvent).filter(Boolean).join("\n"),
  }));

  // Merge small turns forward, split big ones.
  const groups: { events: BLogEvent[]; text: string }[] = [];
  for (const t of rendered) {
    const last = groups[groups.length - 1];
    if (last && last.text.length < MIN_CHARS && last.text.length + 1 + t.text.length <= MAX_CHARS) {
      last.events = last.events.concat(t.events);
      last.text = `${last.text}\n${t.text}`;
      continue;
    }
    if (t.text.length <= MAX_CHARS) {
      groups.push({ events: [...t.events], text: t.text });
      continue;
    }
    // Split an oversized turn on event boundaries.
    let part: BLogEvent[] = [];
    let partText = "";
    for (const e of t.events) {
      const lineText = renderEvent(e);
      if (partText && partText.length + 1 + lineText.length > MAX_CHARS) {
        groups.push({ events: part, text: partText });
        part = [];
        partText = "";
      }
      part.push(e);
      partText = partText ? `${partText}\n${lineText}` : lineText;
    }
    if (part.length) groups.push({ events: part, text: partText });
  }

  return groups.map((g, i) => ({
    id: `c${String(i + 1).padStart(3, "0")}`,
    eventIds: g.events.map((e) => e.id),
    text: g.text,
    startTs: g.events.find((e) => e.ts)?.ts,
    endTs: [...g.events].reverse().find((e) => e.ts)?.ts,
  }));
}
