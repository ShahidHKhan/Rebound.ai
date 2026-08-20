import type Anthropic from "@anthropic-ai/sdk";

export const submitSkeletonRegimeTool: Anthropic.Tool = {
  name: "submit_skeleton_regime",
  description:
    "Submit your exercise selection for every slot in the plan. Call this once you've picked exactly one exercise per slot from that slot's candidate list.",
  input_schema: {
    type: "object",
    properties: {
      selections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slotId: { type: "string" },
            exerciseId: { type: "string", description: "Must be one of the slot's listed candidate IDs." },
            sets: { type: "number" },
            reps: { type: "number" },
            durationSeconds: { type: "number" },
            frequency: { type: "string" },
          },
          required: ["slotId", "exerciseId"],
        },
      },
    },
    required: ["selections"],
  },
};

export interface SkeletonSelection {
  slotId: string;
  exerciseId: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  frequency?: string;
}

export interface SlotWithCandidates {
  id: string;
  candidateIds: Set<string>;
}

// Every slot must be filled exactly once, and only from the candidates that
// were actually offered for that slot — the LLM chooses among pre-narrowed
// options, it doesn't get to invent an exercise id outside them.
export function validateSkeletonSelections(
  selections: SkeletonSelection[],
  slots: SlotWithCandidates[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const selectionsBySlot = new Map<string, SkeletonSelection[]>();

  for (const selection of selections) {
    const existing = selectionsBySlot.get(selection.slotId) ?? [];
    existing.push(selection);
    selectionsBySlot.set(selection.slotId, existing);
  }

  for (const slot of slots) {
    const slotSelections = selectionsBySlot.get(slot.id) ?? [];
    if (slotSelections.length === 0) {
      issues.push(`slot ${slot.id} has no selection.`);
      continue;
    }
    if (slotSelections.length > 1) {
      issues.push(`slot ${slot.id} has ${slotSelections.length} selections, expected exactly 1.`);
    }
    for (const selection of slotSelections) {
      if (!slot.candidateIds.has(selection.exerciseId)) {
        issues.push(`slot ${slot.id}: exercise_id "${selection.exerciseId}" is not one of the offered candidates.`);
      }
    }
  }

  const knownSlotIds = new Set(slots.map((slot) => slot.id));
  for (const selection of selections) {
    if (!knownSlotIds.has(selection.slotId)) {
      issues.push(`slot_id "${selection.slotId}" is not part of this plan.`);
    }
  }

  return { valid: issues.length === 0, issues };
}
