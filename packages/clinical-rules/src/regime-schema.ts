import { z } from "zod";

// Structural validation only — runs before clinical validation and catches
// malformed LLM output before it's even a candidate for clinical review
// (LLM Reliability & Failure Handling).
const SESSION_SLOTS = ["MORNING", "EVENING"] as const;

export const draftRegimeExerciseSchema = z
  .object({
    exerciseId: z.string().min(1),
    sets: z.number().int().min(1).max(10).optional(),
    reps: z.number().int().min(1).max(50).optional(),
    durationSeconds: z.number().int().min(5).max(1800).optional(),
    frequency: z.string().max(50).optional(),
    sessionSlot: z.enum(SESSION_SLOTS),
  })
  .refine((exercise) => exercise.reps !== undefined || exercise.durationSeconds !== undefined, {
    message: "exercise must specify either reps or durationSeconds",
  });

export const draftRegimeSchema = z
  .object({
    exercises: z.array(draftRegimeExerciseSchema).min(1, "exercise_list must be non-empty"),
  })
  .refine(
    (regime) => {
      // Same exercise can appear in both slots (e.g. a stretch done morning
      // and evening) but not twice within the same slot.
      const keys = regime.exercises.map((e) => `${e.exerciseId}:${e.sessionSlot}`);
      return new Set(keys).size === keys.length;
    },
    { message: "duplicate exercise entries are not allowed within the same session slot" }
  );

export type DraftRegimeInput = z.infer<typeof draftRegimeSchema>;

export function validateStructure(draft: unknown) {
  return draftRegimeSchema.safeParse(draft);
}
