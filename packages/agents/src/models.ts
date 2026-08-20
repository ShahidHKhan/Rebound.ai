// Single source of truth for which models the admin experimentation
// dashboard can choose from, and their pricing for cost calc on LlmCall
// rows. Real production Flow A/B traffic never reads this file directly for
// its default — it uses REGIME_MODEL (client.ts) — but this is also where
// estimateCostUsd looks up pricing for every model actually seen on an
// LlmCall row, defaults included, so every model in real use must be listed.
//
// Pricing note: Sonnet 5 intro pricing ($2/$10 per MTok) runs through
// 2026-08-31, moving to $3/$15 after — per the PRD's Tech Stack section.
// Update this table then rather than building date-switching logic now.
// Gemini pricing confirmed against ai.google.dev/gemini-api/docs/pricing,
// 2026-08-20 (provider-swap session).
export const AVAILABLE_MODELS = [
  // gemini-2.5-flash returned a 404 for this API key ("no longer available
  // to new users, use gemini-3.6-flash") — confirmed live 2026-08-20, not
  // just a docs assumption. Pricing promotional through 2026-12-31 per
  // ai.google.dev/gemini-api/docs/pricing.
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (production default)", inputPerMTok: 0.75, outputPerMTok: 3.75 },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (classifier default)", inputPerMTok: 0.25, outputPerMTok: 1.5 },
  { id: "claude-sonnet-5", label: "Sonnet 5", inputPerMTok: 2, outputPerMTok: 10 },
  { id: "claude-opus-5", label: "Opus 5", inputPerMTok: 5, outputPerMTok: 25 },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", inputPerMTok: 1, outputPerMTok: 5 },
] as const;

export type AvailableModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = AVAILABLE_MODELS.find((m) => m.id === model);
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.inputPerMTok + (outputTokens / 1_000_000) * pricing.outputPerMTok;
}
