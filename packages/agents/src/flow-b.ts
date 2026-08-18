import type Anthropic from "@anthropic-ai/sdk";
import type { DraftRegime } from "@rebound/clinical-rules";

import { REGIME_MODEL } from "./client";
import type { FlowCallOptions } from "./flow-a";
import { loggedMessagesCreate } from "./llm-call-logger";
import { searchExercises, searchExercisesTool } from "./tools/search-exercises";
import { submitAdjustmentTool } from "./tools/submit-adjustment";
import { validateExerciseIds } from "./tools/submit-regime";

export interface AdjustmentContext {
  riskTier: string;
  currentRegime: DraftRegime;
  trailingSessionLogs: Array<{ date: string; painScore: number; madeItWorseFlag: boolean }>;
}

export interface ProposedAdjustment {
  decision: "hold" | "progress" | "rollback";
  rationale: string;
  regime: DraftRegime;
}

const MAX_SELF_CORRECTIONS = 2;

export async function proposeAdjustment(
  context: AdjustmentContext,
  revisionFeedback?: string,
  options: FlowCallOptions = {}
): Promise<ProposedAdjustment> {
  const model = options.model ?? REGIME_MODEL;
  const source = options.source ?? "PRODUCTION";
  const groupId = crypto.randomUUID();
  let sequenceIndex = 0;
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Review this user's trailing Session Log trend and decide whether to hold, progress, or roll back their regime.

<risk_tier>${context.riskTier}</risk_tier>

<current_regime>
${JSON.stringify(context.currentRegime, null, 2)}
</current_regime>

<trailing_session_logs>
${JSON.stringify(context.trailingSessionLogs, null, 2)}
</trailing_session_logs>

Use search_exercises if you want to swap or add exercises. Call submit_adjustment with your final decision, rationale, and the complete exercise list for the new (or held) regime.${
        revisionFeedback
          ? `\n\n<previous_attempt_rejected>\n${revisionFeedback}\n</previous_attempt_rejected>`
          : ""
      }`,
    },
  ];

  const tools = [searchExercisesTool, submitAdjustmentTool];
  let correctionAttempts = 0;

  while (true) {
    const response = await loggedMessagesCreate(
      { model, max_tokens: 4096, tools, messages },
      {
        flow: "FLOW_B_ADJUST",
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
    let submitted: ProposedAdjustment | null = null;

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      if (block.name === "search_exercises") {
        const results = await searchExercises(block.input as Parameters<typeof searchExercises>[0]);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(results) });
      }

      if (block.name === "submit_adjustment") {
        const input = block.input as {
          decision: "hold" | "progress" | "rollback";
          rationale: string;
          exercises: DraftRegime["exercises"];
        };

        // Same defensive check as flow-a.ts's submit_regime handler: a
        // malformed tool call (missing/non-array exercises) previously
        // crashed here instead of getting a self-correction chance.
        if (!Array.isArray(input?.exercises)) {
          if (correctionAttempts < MAX_SELF_CORRECTIONS) {
            correctionAttempts++;
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `submit_adjustment call is missing a valid "exercises" array. Call submit_adjustment again with a complete exercises array.`,
              is_error: true,
            });
          } else {
            throw new Error("submit_adjustment repeatedly returned a malformed exercises array after self-correction attempts");
          }
          continue;
        }

        const exerciseIds = input.exercises.map((e) => e.exerciseId);
        const { valid, invalidIds } = await validateExerciseIds(exerciseIds);

        if (!valid && correctionAttempts < MAX_SELF_CORRECTIONS) {
          correctionAttempts++;
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `exercise_id not found: ${invalidIds.join(", ")}. Use only IDs returned by search_exercises or already present in current_regime.`,
            is_error: true,
          });
        } else {
          submitted = {
            decision: input.decision,
            rationale: input.rationale,
            regime: { exercises: input.exercises },
          };
        }
      }
    }

    if (submitted) return submitted;
    messages.push({ role: "user", content: toolResults });
  }
}
