import { z } from "zod";

import { registry } from "../registry";
import { equipmentSchema } from "./exercise";
import { goalTypeSchema } from "./user";

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
  goalType: goalTypeSchema,
  conditionFlags: z.array(z.string()),
  injurySeverity: z.enum(["none", "mild", "moderate", "severe"]),
  redFlags: redFlagAnswersSchema,
});

// Free-Text Input Handling: length-bounded (~500-750 chars) — controls token
// cost and shrinks the prompt-injection surface. Canonical copy — moved here
// from packages/api/src/schemas.ts (which now re-exports this instead of
// re-declaring it) so the tRPC and REST request-validation paths can never
// drift from each other during the coexistence window. Shared by the real
// onboarding.submit endpoint and admin ONBOARDING-type test fixtures.
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
  // Equipment the user has access to at home. Omitted/empty means
  // bodyweight-only.
  availableEquipment: z.array(equipmentSchema).optional(),
});
export type OnboardingSubmissionInput = z.infer<typeof onboardingSubmissionSchema>;

// --- onboarding.submit response: 4 discriminated outcomes, all HTTP 200 ---
// These are successful screening results, not errors — mapping them to 4xx
// would force client rewrites and risk the mutation-retry-on-401 logic
// misfiring on a business outcome. Decided in the migration plan; don't
// revisit this mid-implementation.

export const onboardingSubmitCrisisResponseSchema = registry.register(
  "OnboardingSubmitCrisisResponse",
  z.object({ status: z.literal("crisis_detected"), reasons: z.array(z.string()) })
);

export const onboardingSubmitRedFlaggedResponseSchema = registry.register(
  "OnboardingSubmitRedFlaggedResponse",
  z.object({ status: z.literal("red_flagged"), reasons: z.array(z.string()) })
);

export const onboardingSubmitCooldownResponseSchema = registry.register(
  "OnboardingSubmitCooldownResponse",
  z.object({ status: z.literal("cooldown_active"), regimeCreatedAt: z.string().datetime() })
);

export const onboardingSubmitJobCreatedResponseSchema = registry.register(
  "OnboardingSubmitJobCreatedResponse",
  z.object({ status: z.literal("job_created"), jobId: z.string() })
);

export const onboardingSubmitResponseSchema = z.discriminatedUnion("status", [
  onboardingSubmitCrisisResponseSchema,
  onboardingSubmitRedFlaggedResponseSchema,
  onboardingSubmitCooldownResponseSchema,
  onboardingSubmitJobCreatedResponseSchema,
]);
export type OnboardingSubmitResponse = z.infer<typeof onboardingSubmitResponseSchema>;

// Mirrors packages/db/prisma/schema.prisma's JobStatus enum.
export const jobStatusSchema = z.enum(["PENDING", "COMPLETE", "FAILED"]);

export const onboardingJobStatusResponseSchema = registry.register(
  "OnboardingJobStatusResponse",
  z.object({
    id: z.string(),
    status: jobStatusSchema,
    resultRegimeId: z.string().nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
);
export type OnboardingJobStatusResponse = z.infer<typeof onboardingJobStatusResponseSchema>;

const jobIdParamSchema = z.object({ jobId: z.string() });

registry.registerPath({
  method: "post",
  path: "/onboarding",
  tags: ["onboarding"],
  summary:
    "Submit onboarding answers — screens for crisis/red-flag/cooldown, else kicks off async regime generation",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: onboardingSubmissionSchema } } },
  },
  responses: {
    200: {
      description:
        "Always 200 — all four outcomes (crisis_detected/red_flagged/cooldown_active/job_created) are successful screening results, not errors.",
      content: { "application/json": { schema: onboardingSubmitResponseSchema } },
    },
    400: { description: "Invalid input" },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "get",
  path: "/onboarding/jobs/{jobId}",
  tags: ["onboarding"],
  summary: "Poll a regime-generation job's status",
  security: [{ bearerAuth: [] }],
  request: { params: jobIdParamSchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: onboardingJobStatusResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Job belongs to another user" },
  },
});
