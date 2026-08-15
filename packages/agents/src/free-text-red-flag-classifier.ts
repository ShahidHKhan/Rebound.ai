import type Anthropic from "@anthropic-ai/sdk";

import { anthropic } from "./client";
import { classifyRedFlagsTool } from "./tools/classify-red-flags";

// Classification, not generation — Haiku is the right tier per Tech Stack.
const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

export interface FreeTextClassification {
  flagged: boolean;
  reasons: string[];
  crisisFlagged: boolean;
  crisisReasons: string[];
}

export async function classifyFreeTextRedFlags(freeText: string): Promise<FreeTextClassification> {
  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 512,
    tools: [classifyRedFlagsTool],
    tool_choice: { type: "tool", name: "classify_red_flags" },
    messages: [
      {
        role: "user",
        content: `Classify this onboarding free text for clinical red flags:\n\n<free_text>\n${freeText}\n</free_text>`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Expected classify_red_flags tool call, got none");
  }

  return toolUse.input as FreeTextClassification;
}
