import type Anthropic from "@anthropic-ai/sdk";
import type { DraftRegime } from "@rebound/clinical-rules";

import { anthropic, REGIME_MODEL } from "./client";
import { searchExercises, searchExercisesTool } from "./tools/search-exercises";
import { submitRegimeTool, validateExerciseIds } from "./tools/submit-regime";

export interface RegimeGenerationContext {
  goalType: string;
  targetMovement: string;
  riskTier: string;
  symptomsText: string;
  lifestyleContextText: string;
}

const MAX_SELF_CORRECTIONS = 2;

export async function generateInitialRegime(context: RegimeGenerationContext): Promise<DraftRegime> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Draft a two-session (morning + evening) exercise regime for this user.

<user_context>
Goal: ${context.goalType}
Target movement: ${context.targetMovement}
Risk tier: ${context.riskTier}
Symptoms: ${context.symptomsText}
Lifestyle context: ${context.lifestyleContextText}
</user_context>

Use search_exercises to find candidates, then call submit_regime with your final selection. Every exercise must be assigned to either the morning or evening slot.`,
    },
  ];

  const tools = [searchExercisesTool, submitRegimeTool];
  let correctionAttempts = 0;

  while (true) {
    const response = await anthropic.messages.create({
      model: REGIME_MODEL,
      max_tokens: 4096,
      tools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      throw new Error(`Expected a tool call, got stop_reason: ${response.stop_reason}`);
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let submitted: DraftRegime | null = null;

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      if (block.name === "search_exercises") {
        const results = await searchExercises(block.input as Parameters<typeof searchExercises>[0]);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(results) });
      }

      if (block.name === "submit_regime") {
        const draft = block.input as DraftRegime;
        const exerciseIds = draft.exercises.map((e) => e.exerciseId);
        const { valid, invalidIds } = await validateExerciseIds(exerciseIds);

        if (!valid && correctionAttempts < MAX_SELF_CORRECTIONS) {
          correctionAttempts++;
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `exercise_id not found: ${invalidIds.join(", ")}. Use only IDs returned by search_exercises.`,
            is_error: true,
          });
        } else {
          submitted = draft;
        }
      }
    }

    if (submitted) return submitted;
    messages.push({ role: "user", content: toolResults });
  }
}
