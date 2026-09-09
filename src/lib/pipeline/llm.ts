/**
 * LLM provider factory (CLAUDE.md: pipeline code never knows the provider).
 *
 * Decision 2026-09-09: the product LLM is Upstage Solar Pro 4, single vendor
 * (embeddings too). The AI SDK abstraction stays — swapping models later is a
 * config change here, nothing else. Prices: USD per 1M tokens, estimates only.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export interface ProviderConfig {
  key: "upstage";
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
];

export const MAIN_PROVIDER = PROVIDERS[0];

export function isConfigured(p: ProviderConfig): boolean {
  return Boolean(process.env[p.envVar]);
}

export function getModel(p: ProviderConfig): LanguageModel {
  const upstage = createOpenAICompatible({
    name: "upstage",
    baseURL: "https://api.upstage.ai/v1",
    apiKey: process.env.UPSTAGE_API_KEY ?? "",
    // Upstage supports OpenAI-style response_format (json_object 검증 완료).
    // Without this flag the AI SDK silently skips JSON mode for generateObject.
    supportsStructuredOutputs: true,
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
