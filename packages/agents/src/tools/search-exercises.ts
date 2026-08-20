import type Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@rebound/db";
import type { Equipment } from "@rebound/db";

export const searchExercisesTool: Anthropic.Tool = {
  name: "search_exercises",
  description:
    "Search the exercise library by category, target muscle group, and/or max difficulty level. Returns matching exercises with their IDs.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["MOBILITY", "STRENGTH", "STRETCH"],
        description: "Filter by exercise category",
      },
      muscleGroup: {
        type: "string",
        description: "Filter by a target muscle group, e.g. 'lower back', 'quadriceps'",
      },
      maxDifficulty: {
        type: "number",
        description: "Maximum difficulty level (1=beginner, 2=intermediate, 3=expert)",
      },
    },
  },
};

interface SearchExercisesInput {
  category?: "MOBILITY" | "STRENGTH" | "STRETCH";
  muscleGroup?: string;
  // Slot-filling (skeleton path) passes several candidate tags at once
  // instead of the single string the LLM-facing tool exposes.
  muscleGroupTags?: string[];
  maxDifficulty?: number;
}

// availableEquipment is never LLM-controlled — it's a hard constraint from
// the user's onboarding answers, applied the same way regardless of what
// the caller (freeform tool loop or skeleton slot-filling) asks for.
// BODY_ONLY and unrecorded (null) equipment are always eligible.
export async function searchExercises(input: SearchExercisesInput, availableEquipment: Equipment[] = []) {
  return prisma.exercise.findMany({
    where: {
      ...(input.category ? { category: input.category } : {}),
      ...(input.muscleGroup ? { targetMuscleGroups: { has: input.muscleGroup } } : {}),
      ...(input.muscleGroupTags && input.muscleGroupTags.length > 0
        ? { targetMuscleGroups: { hasSome: input.muscleGroupTags } }
        : {}),
      ...(input.maxDifficulty ? { difficultyLevel: { lte: input.maxDifficulty } } : {}),
      OR: [
        { equipment: null },
        { equipment: "BODY_ONLY" },
        ...(availableEquipment.length > 0 ? [{ equipment: { in: availableEquipment } }] : []),
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      category: true,
      targetMuscleGroups: true,
      difficultyLevel: true,
      equipment: true,
    },
  });
}
