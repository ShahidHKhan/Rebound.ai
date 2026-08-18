import type Anthropic from "@anthropic-ai/sdk";
import type { DraftRegime } from "@rebound/clinical-rules";
import type { LlmCallSource } from "@rebound/db";

import { REGIME_MODEL } from "./client";
import { loggedMessagesCreate } from "./llm-call-logger";
import { searchExercises, searchExercisesTool } from "./tools/search-exercises";
import { submitRegimeTool, validateExerciseIds } from "./tools/submit-regime";

export interface RegimeGenerationContext {
  goalType: string;
  targetMovement: string;
  riskTier: string;
  symptomsText: string;
  lifestyleContextText: string;
}

// Defaults keep every existing (real) call site behavior-identical — they
// simply don't pass this, so they get REGIME_MODEL + source "PRODUCTION".
// Only the admin test-run path (packages/agents/src/admin-test-runs.ts)
// ever passes a non-default model — this is what makes model swapping
// test-only rather than a convention someone has to remember.
export interface FlowCallOptions {
  model?: string;
  source?: LlmCallSource;
  userId?: string;
  testRunId?: string;
}

const MAX_SELF_CORRECTIONS = 2;

export async function generateInitialRegime(
  context: RegimeGenerationContext,
  options: FlowCallOptions = {}
): Promise<DraftRegime> {
  const model = options.model ?? REGIME_MODEL;
  const source = options.source ?? "PRODUCTION";
  const groupId = crypto.randomUUID();
  let sequenceIndex = 0;
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
    const response = await loggedMessagesCreate(
      { model, max_tokens: 4096, tools, messages },
      {
        flow: "FLOW_A_DRAFT",
        source,
        groupId,
        sequenceIndex: sequenceIndex++,
        userId: options.userId,
        testRunId: options.testRunId,
      }
    );

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

        // Defensive check before indexing into the LLM's raw tool-call
        // input: a malformed submit_regime call (missing/non-array
        // `exercises`) previously crashed here with an unhandled TypeError
        // instead of getting a self-correction chance — same treatment as
        // an invalid exercise ID below, just one layer earlier.
        if (!Array.isArray(draft?.exercises)) {
          if (correctionAttempts < MAX_SELF_CORRECTIONS) {
            correctionAttempts++;
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `submit_regime call is missing a valid "exercises" array. Call submit_regime again with a complete exercises array.`,
              is_error: true,
            });
          } else {
            throw new Error("submit_regime repeatedly returned a malformed exercises array after self-correction attempts");
          }
          continue;
        }

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
