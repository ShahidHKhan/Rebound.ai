import type Anthropic from "@anthropic-ai/sdk";
import type { DraftRegime } from "@rebound/clinical-rules";

import { anthropic, REGIME_MODEL } from "./client";
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
  revisionFeedback?: string
): Promise<ProposedAdjustment> {
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
