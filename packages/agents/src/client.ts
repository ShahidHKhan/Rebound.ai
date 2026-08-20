import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cost-conscious default (provider-swap session, 2026-08-20) — Gemini for
// both Flow A and Flow B calls. Claude models remain fully callable via
// FlowCallOptions.model / the admin test-run picker (models.ts), reserved
// for more complex tasks or side-by-side comparison, just not the default
// for real production traffic anymore.
export const REGIME_MODEL = "gemini-3.6-flash";
