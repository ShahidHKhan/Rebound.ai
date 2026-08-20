import type Anthropic from "@anthropic-ai/sdk";
import type { DraftRegime } from "@rebound/clinical-rules";
import type { Equipment, GoalType, LlmCallSource, RiskTier } from "@rebound/db";

import { REGIME_MODEL } from "./client";
import { loggedMessagesCreate } from "./llm-call-logger";
import { findSkeletonPreset, type SkeletonWithSlots } from "./skeleton-retrieval";
import { searchExercises, searchExercisesTool } from "./tools/search-exercises";
import { submitRegimeTool, validateExerciseIds } from "./tools/submit-regime";
import {
  submitSkeletonRegimeTool,
  validateSkeletonSelections,
  type SkeletonSelection,
} from "./tools/submit-skeleton-regime";

export interface RegimeGenerationContext {
  goalType: GoalType;
  targetMovement: string;
  riskTier: RiskTier;
  symptomsText: string;
  lifestyleContextText: string;
  // Defaults to [] (bodyweight-only) when omitted — existing call sites that
  // predate equipment capture stay behavior-identical (conservative, not a
  // silent widening of what gets recommended).
  availableEquipment?: Equipment[];
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

export interface GenerateInitialRegimeResult {
  draft: DraftRegime;
  // The skeleton Preset this draft was built from, or null if no matching
  // skeleton existed and the freeform fallback path ran instead.
  sourcePresetId: string | null;
}

const MAX_SELF_CORRECTIONS = 2;

// Retrieval-then-fill: try a literature-grounded skeleton first (goalType x
// riskTier, keyword-matched to the free-text goal/symptoms) and constrain
// the LLM to filling its slots from pre-narrowed, equipment-filtered
// candidates. Falls back to the older fully-freeform path only when no
// skeleton exists yet for this combination — see HANDOFF's Flow A/B
// research session for why this replaced pure freeform generation.
export async function generateInitialRegime(
  context: RegimeGenerationContext,
  options: FlowCallOptions = {}
): Promise<GenerateInitialRegimeResult> {
  const availableEquipment = context.availableEquipment ?? [];

  const skeleton = await findSkeletonPreset({
    goalType: context.goalType,
    riskTier: context.riskTier,
    targetMovement: context.targetMovement,
    symptomsText: context.symptomsText,
  });

  if (skeleton) {
    const draft = await generateFromSkeleton(skeleton, context, availableEquipment, options);
    if (draft) {
      return { draft, sourcePresetId: skeleton.id };
    }
    // A slot came back with zero equipment/difficulty-eligible candidates —
    // the skeleton doesn't actually fit this user right now. Fall through
    // to freeform rather than persisting a broken plan.
  }

  const draft = await generateFreeform(context, availableEquipment, options);
  return { draft, sourcePresetId: null };
}

async function generateFromSkeleton(
  skeleton: SkeletonWithSlots,
  context: RegimeGenerationContext,
  availableEquipment: Equipment[],
  options: FlowCallOptions
): Promise<DraftRegime | null> {
  const model = options.model ?? REGIME_MODEL;
  const source = options.source ?? "PRODUCTION";

  const slotsWithCandidates = await Promise.all(
    skeleton.slots.map(async (slot) => {
      const candidates = await searchExercises(
        {
          category: slot.exerciseCategory ?? undefined,
          muscleGroupTags: slot.muscleGroupTags,
          maxDifficulty: slot.maxDifficulty ?? undefined,
        },
        availableEquipment
      );
      return { slot, candidates };
    })
  );

  if (slotsWithCandidates.some(({ candidates }) => candidates.length === 0)) {
    return null;
  }

  const slotsBlock = slotsWithCandidates
    .map(({ slot, candidates }) => {
      const candidateLines = candidates
        .map(
          (c) =>
            `  - ${c.id}: ${c.name} (muscles: ${c.targetMuscleGroups.join(", ") || "n/a"}, difficulty: ${c.difficultyLevel}, equipment: ${c.equipment ?? "none"})`
        )
        .join("\n");
      const suggested = [
        slot.suggestedSets ? `${slot.suggestedSets} sets` : null,
        slot.suggestedReps ? `${slot.suggestedReps} reps` : null,
        slot.suggestedDurationSeconds ? `${slot.suggestedDurationSeconds}s` : null,
        slot.suggestedFrequency ?? null,
      ]
        .filter(Boolean)
        .join(", ");
      return `Slot ${slot.id} (${slot.sessionSlot}) — ${slot.label}\nSuggested dosing: ${suggested || "none"}\nCandidates:\n${candidateLines}`;
    })
    .join("\n\n");

  const slots = slotsWithCandidates.map(({ slot, candidates }) => ({
    id: slot.id,
    sessionSlot: slot.sessionSlot,
    suggestedSets: slot.suggestedSets,
    suggestedReps: slot.suggestedReps,
    suggestedDurationSeconds: slot.suggestedDurationSeconds,
    suggestedFrequency: slot.suggestedFrequency,
    candidateIds: new Set(candidates.map((c) => c.id)),
  }));

  const groupId = crypto.randomUUID();
  let sequenceIndex = 0;
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `This user's plan shape has already been chosen: the "${skeleton.name}" protocol. Do not deviate from its slots — only choose which specific exercise fills each one, and personalize the dosing to this user within the suggested range if appropriate.

<user_context>
Goal: ${context.goalType}
Target movement: ${context.targetMovement}
Symptoms: ${context.symptomsText}
Lifestyle context: ${context.lifestyleContextText}
</user_context>

<slots>
${slotsBlock}
</slots>

Call submit_skeleton_regime with exactly one exercise_id per slot, chosen only from that slot's candidates.`,
    },
  ];

  const tools = [submitSkeletonRegimeTool];
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
    let validSelections: SkeletonSelection[] | null = null;

    for (const block of response.content) {
      if (block.type !== "tool_use" || block.name !== "submit_skeleton_regime") continue;

      const selections = (block.input as { selections?: SkeletonSelection[] })?.selections;
      if (!Array.isArray(selections)) {
        if (correctionAttempts < MAX_SELF_CORRECTIONS) {
          correctionAttempts++;
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `submit_skeleton_regime call is missing a valid "selections" array. Call it again with one selection per slot.`,
            is_error: true,
          });
        } else {
          throw new Error("submit_skeleton_regime repeatedly returned a malformed selections array after self-correction attempts");
        }
        continue;
      }

      const { valid, issues } = validateSkeletonSelections(selections, slots);
      if (!valid && correctionAttempts < MAX_SELF_CORRECTIONS) {
        correctionAttempts++;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Selection errors: ${issues.join(" ")}`,
          is_error: true,
        });
      } else if (!valid) {
        throw new Error(`submit_skeleton_regime repeatedly failed validation: ${issues.join(" ")}`);
      } else {
        validSelections = selections;
      }
    }

    if (validSelections) {
      const bySlotId = new Map(validSelections.map((sel) => [sel.slotId, sel]));
      return {
        exercises: skeleton.slots.map((slot) => {
          const sel = bySlotId.get(slot.id)!;
          return {
            exerciseId: sel.exerciseId,
            sets: sel.sets ?? slot.suggestedSets ?? undefined,
            reps: sel.reps ?? slot.suggestedReps ?? undefined,
            durationSeconds: sel.durationSeconds ?? slot.suggestedDurationSeconds ?? undefined,
            frequency: sel.frequency ?? slot.suggestedFrequency ?? undefined,
            sessionSlot: slot.sessionSlot,
          };
        }),
      };
    }
    messages.push({ role: "user", content: toolResults });
  }
}

// The original fully-freeform path — kept as the fallback for any
// goalType/riskTier combination that doesn't have a skeleton yet.
async function generateFreeform(
  context: RegimeGenerationContext,
  availableEquipment: Equipment[],
  options: FlowCallOptions
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
        const results = await searchExercises(
          block.input as Parameters<typeof searchExercises>[0],
          availableEquipment
        );
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
