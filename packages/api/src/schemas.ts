import { z } from "zod";

// Canonical definition moved to packages/contracts (needed there for OpenAPI
// generation) — re-exported here so every existing import of
// `onboardingSubmissionSchema` from this file keeps working unchanged, and
// so the tRPC and REST request-validation paths can never drift from each
// other during the coexistence window.
export { onboardingSubmissionSchema } from "@rebound/contracts";

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
