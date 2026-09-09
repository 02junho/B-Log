/**
 * Tagging engine (Step 6, P1).
 *
 * chunks → parallel LLM tagging (bounded concurrency) → verified findings.
 * Production path per CLAUDE.md: JSON mode (`generateObject` + zod) with one
 * retry; quotes that don't occur verbatim in their chunk are dropped here so
 * nothing downstream (DB, portfolio, review UI) ever sees an unverified
 * quote. Concurrency 4~6 keeps a 30+ chunk session well inside Vercel's
 * 300s function limit (~5s per call, measured 9/9).
 *
 * The LLM call is injectable (`runner`) so the engine is testable without a
 * network; the default runner is the real thing.
 */
import { generateObject } from "ai";
import type { Chunk } from "./chunk";
import { getModel, MAIN_PROVIDER } from "./llm";
import {
  TAGGING_SYSTEM,
  taggingOutputSchema,
  taggingUserPrompt,
  type TaggingOutput,
} from "../prompts/tagging";
import type { Stage } from "../portfolio/view";

export interface TaggedFinding {
  chunkId: string;
  stage: Stage;
  summary: string;
  quote: { eventId: string; text: string };
  confidence: number;
}

export interface ChunkTagResult {
  chunkId: string;
  ok: boolean;
  error?: string;
  findings: TaggedFinding[];
  /** Findings dropped because the quote wasn't verbatim in the chunk. */
  droppedQuotes: number;
  inputTokens: number;
  outputTokens: number;
}

export interface SessionTagResult {
  results: ChunkTagResult[];
  findings: TaggedFinding[];
  failedChunks: string[];
  inputTokens: number;
  outputTokens: number;
}

export type ChunkRunner = (
  chunk: Chunk,
) => Promise<{ output: TaggingOutput; inputTokens: number; outputTokens: number }>;

/** Default runner: real LLM call on the main provider. */
export const llmRunner: ChunkRunner = async (chunk) => {
  const res = await generateObject({
    model: getModel(MAIN_PROVIDER),
    schema: taggingOutputSchema,
    system: TAGGING_SYSTEM,
    prompt: taggingUserPrompt(chunk.text),
    maxOutputTokens: 2000,
  });
  return {
    output: res.object as TaggingOutput,
    inputTokens: res.usage?.inputTokens ?? 0,
    outputTokens: res.usage?.outputTokens ?? 0,
  };
};

/** Order-preserving parallel map with bounded concurrency. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function tagChunk(
  chunk: Chunk,
  runner: ChunkRunner = llmRunner,
): Promise<ChunkTagResult> {
  const base: ChunkTagResult = {
    chunkId: chunk.id,
    ok: false,
    findings: [],
    droppedQuotes: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output, inputTokens, outputTokens } = await runner(chunk);
      base.inputTokens += inputTokens;
      base.outputTokens += outputTokens;
      const verified: TaggedFinding[] = [];
      for (const f of output.findings) {
        const ok =
          chunk.eventIds.includes(f.quote.eventId) &&
          chunk.text.includes(f.quote.text);
        if (ok) verified.push({ chunkId: chunk.id, ...f });
        else base.droppedQuotes++;
      }
      return { ...base, ok: true, findings: verified };
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 200) : String(err);
    }
  }
  return { ...base, error: lastError };
}

export async function tagSession(
  chunks: readonly Chunk[],
  options: {
    concurrency?: number;
    runner?: ChunkRunner;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<SessionTagResult> {
  const { concurrency = 5, runner = llmRunner, onProgress } = options;
  let done = 0;
  const results = await mapWithConcurrency(chunks, concurrency, async (chunk) => {
    const r = await tagChunk(chunk, runner);
    onProgress?.(++done, chunks.length);
    return r;
  });
  return {
    results,
    findings: results.flatMap((r) => r.findings),
    failedChunks: results.filter((r) => !r.ok).map((r) => r.chunkId),
    inputTokens: results.reduce((a, r) => a + r.inputTokens, 0),
    outputTokens: results.reduce((a, r) => a + r.outputTokens, 0),
  };
}
