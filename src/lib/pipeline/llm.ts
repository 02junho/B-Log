/**
 * LLM provider factory (CLAUDE.md: pipeline code never knows the provider).
 *
 * Both candidates are exposed behind the Vercel AI SDK `LanguageModel`
 * interface; swapping the main model after Step 4 is a config change here,
 * nothing else. Prices: USD per 1M tokens, used only for cost estimates.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export interface ProviderConfig {
  key: "anthropic" | "upstage";
  label: string;
  modelId: string;
  envVar: string;
  priceInPer1M: number;
  priceOutPer1M: number;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    key: "upstage",
    label: "Upstage Solar Pro 4",
    modelId: process.env.UPSTAGE_MODEL ?? "solar-pro4",
    envVar: "UPSTAGE_API_KEY",
    priceInPer1M: 0.3,
    priceOutPer1M: 1.2,
  },
  {
    key: "anthropic",
    label: "Claude Sonnet 5",
    modelId: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    envVar: "ANTHROPIC_API_KEY",
    priceInPer1M: 2,
    priceOutPer1M: 10,
  },
];

export function isConfigured(p: ProviderConfig): boolean {
  return Boolean(process.env[p.envVar]);
}

export function getModel(p: ProviderConfig): LanguageModel {
  if (p.key === "anthropic") return anthropic(p.modelId);
  const upstage = createOpenAICompatible({
    name: "upstage",
    baseURL: "https://api.upstage.ai/v1",
    apiKey: process.env.UPSTAGE_API_KEY ?? "",
  });
  return upstage(p.modelId);
}

export function estimateCostUsd(
  p: ProviderConfig,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1e6) * p.priceInPer1M + (outputTokens / 1e6) * p.priceOutPer1M
  );
}
