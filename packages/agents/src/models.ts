// Single source of truth for which models the admin experimentation
// dashboard can choose from, and their pricing for cost calc on LlmCall
// rows. Real production Flow A/B traffic never reads this file — it always
// uses REGIME_MODEL (client.ts) — this is purely for admin test runs.
//
// Pricing note: Sonnet 5 intro pricing ($2/$10 per MTok) runs through
// 2026-08-31, moving to $3/$15 after — per the PRD's Tech Stack section.
// Update this table then rather than building date-switching logic now.
export const AVAILABLE_MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5 (production default)", inputPerMTok: 2, outputPerMTok: 10 },
  { id: "claude-opus-5", label: "Opus 5", inputPerMTok: 5, outputPerMTok: 25 },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", inputPerMTok: 1, outputPerMTok: 5 },
] as const;

export type AvailableModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = AVAILABLE_MODELS.find((m) => m.id === model);
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.inputPerMTok + (outputTokens / 1_000_000) * pricing.outputPerMTok;
}
