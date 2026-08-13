import type Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@rebound/db";

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
  maxDifficulty?: number;
}

export async function searchExercises(input: SearchExercisesInput) {
  return prisma.exercise.findMany({
    where: {
      ...(input.category ? { category: input.category } : {}),
      ...(input.muscleGroup ? { targetMuscleGroups: { has: input.muscleGroup } } : {}),
      ...(input.maxDifficulty ? { difficultyLevel: { lte: input.maxDifficulty } } : {}),
    },
    take: 10,
    select: { id: true, name: true, category: true, targetMuscleGroups: true, difficultyLevel: true },
  });
}
