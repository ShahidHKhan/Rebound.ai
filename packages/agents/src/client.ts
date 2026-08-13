import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Per Tech Stack: Sonnet 5 for both Flow A and Flow B calls.
export const REGIME_MODEL = "claude-sonnet-5";
