import { z } from "zod";

const redFlagAnswersSchema = z.object({
  severeSuddenPain: z.boolean(),
  numbnessOrTingling: z.boolean(),
  recentTrauma: z.boolean(),
  recentSurgery: z.boolean(),
  pregnancyRelated: z.boolean(),
  cardiacSymptomsWithExertion: z.boolean(),
});

const onboardingAnswersSchema = z.object({
  age: z.number().int().min(13).max(120),
  goalType: z.enum(["INJURY_RECOVERY", "STRENGTH", "MOBILITY", "GENERAL_FITNESS"]),
  conditionFlags: z.array(z.string()),
  injurySeverity: z.enum(["none", "mild", "moderate", "severe"]),
  redFlags: redFlagAnswersSchema,
});

// Free-Text Input Handling: length-bounded (~500-750 chars) — controls
// token cost and shrinks the prompt-injection surface. Shared by the real
// onboarding.submit procedure and admin ONBOARDING-type test fixtures, so
// a fixture is always guaranteed to match what real onboarding accepts.
export const onboardingSubmissionSchema = z.object({
  answers: onboardingAnswersSchema,
  targetMovement: z.string().min(1).max(200),
  symptomsText: z.string().max(750),
  lifestyleContextText: z.string().max(750),
  // Daily Session Structure: morning "on wake", evening at a user-picked
  // time. Both optional — regime.activate falls back to 7am/6pm placeholders
  // when either is missing, so skipping these doesn't block onboarding.
  wakeTimeMinutes: z.number().int().min(0).max(1439).optional(),
  eveningTimeMinutes: z.number().int().min(0).max(1439).optional(),
});

const draftRegimeExerciseSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  frequency: z.string().optional(),
  sessionSlot: z.enum(["MORNING", "EVENING"]),
});

// Shape an ADJUSTMENT-type TestFixture's payload must match — mirrors what
// Flow B's AdjustmentContext needs (packages/agents/src/flow-b.ts).
export const adjustmentFixtureSchema = z.object({
  riskTier: z.enum(["GENERAL", "LIGHT_INJURY", "HEAVIER_CHRONIC_ELDERLY"]),
  currentRegime: z.object({ exercises: z.array(draftRegimeExerciseSchema) }),
  trailingSessionLogs: z.array(
    z.object({
      date: z.string(),
      painScore: z.number().int().min(0).max(10),
      madeItWorseFlag: z.boolean(),
    })
  ),
});
