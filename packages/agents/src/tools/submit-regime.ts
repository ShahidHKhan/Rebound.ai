import type Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@rebound/db";

export const submitRegimeTool: Anthropic.Tool = {
  name: "submit_regime",
  description:
    "Submit the final drafted regime. Call this once you've selected all exercises for both morning and evening sessions. Every exercise_id must come from a prior search_exercises result.",
  input_schema: {
    type: "object",
    properties: {
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            exerciseId: { type: "string" },
            sets: { type: "number" },
            reps: { type: "number" },
            durationSeconds: { type: "number" },
            frequency: { type: "string" },
            sessionSlot: { type: "string", enum: ["MORNING", "EVENING"] },
          },
          required: ["exerciseId", "sessionSlot"],
        },
      },
    },
    required: ["exercises"],
  },
};

export async function validateExerciseIds(
  exerciseIds: string[]
): Promise<{ valid: boolean; invalidIds: string[] }> {
  const found = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((e) => e.id));
  const invalidIds = exerciseIds.filter((id) => !foundIds.has(id));
  return { valid: invalidIds.length === 0, invalidIds };
}
