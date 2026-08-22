import { z } from "zod";

import { registry } from "../registry";
import { exerciseCategorySchema, exerciseResponseSchema } from "./exercise";
import { goalTypeSchema } from "./user";

export const sessionSlotSchema = z.enum(["MORNING", "EVENING"]);
export const regimeStatusSchema = z.enum(["DRAFT", "ACTIVE", "SUPERSEDED", "ENDED"]);
export const regimeCreatedBySchema = z.enum(["AGENT", "USER_EDITED", "PRESET_FALLBACK"]);
export const riskTierSchema = z.enum(["GENERAL", "LIGHT_INJURY", "HEAVIER_CHRONIC_ELDERLY"]);
export const presetKindSchema = z.enum(["FALLBACK", "SKELETON"]);

// Mirrors packages/api/src/routers/regime.ts's exerciseEditSchema exactly —
// deliberately NOT the same schema as packages/clinical-rules'
// draftRegimeExerciseSchema (different bounds, different purpose: this is
// user-facing input validation, that's internal structural validation).
// Reconciling them would be a real behavior change to one or the other, not
// a mechanical migration step — see the migration plan's Phase 4 notes.
export const regimeExerciseEditSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(10).optional(),
  reps: z.number().int().min(1).max(50).optional(),
  durationSeconds: z.number().int().min(5).max(1800).optional(),
  frequency: z.string().max(50).optional(),
  sessionSlot: sessionSlotSchema,
});

const regimeExerciseResponseSchema = z.object({
  id: z.string(),
  regimeId: z.string(),
  exerciseId: z.string(),
  sets: z.number().int().nullable(),
  reps: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  frequency: z.string().nullable(),
  sessionSlot: sessionSlotSchema,
  orderIndex: z.number().int(),
  exercise: exerciseResponseSchema,
});

const presetSlotResponseSchema = z.object({
  id: z.string(),
  presetId: z.string(),
  sessionSlot: sessionSlotSchema,
  orderIndex: z.number().int(),
  label: z.string(),
  exerciseCategory: exerciseCategorySchema.nullable(),
  muscleGroupTags: z.array(z.string()),
  maxDifficulty: z.number().int().nullable(),
  suggestedSets: z.number().int().nullable(),
  suggestedReps: z.number().int().nullable(),
  suggestedDurationSeconds: z.number().int().nullable(),
  suggestedFrequency: z.string().nullable(),
  rationale: z.string().nullable(),
});

const sourcePresetResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  riskTier: riskTierSchema.nullable(),
  createdAt: z.string().datetime(),
  kind: presetKindSchema,
  goalType: goalTypeSchema.nullable(),
  bodyRegionTags: z.array(z.string()),
  slots: z.array(presetSlotResponseSchema),
});

export const regimeResponseSchema = registry.register(
  "Regime",
  z.object({
    id: z.string(),
    userId: z.string(),
    versionNumber: z.number().int(),
    createdAt: z.string().datetime(),
    createdBy: regimeCreatedBySchema,
    status: regimeStatusSchema,
    endReason: z.string().nullable(),
    sourcePresetId: z.string().nullable(),
    sourcePreset: sourcePresetResponseSchema.nullable(),
    parentRegimeId: z.string().nullable(),
    exerciseList: z.array(regimeExerciseResponseSchema),
  })
);
export type RegimeResponse = z.infer<typeof regimeResponseSchema>;

export const activateRegimeRequestSchema = z.object({
  // Present only if the user edited the draft before activating.
  exercises: z.array(regimeExerciseEditSchema).optional(),
});
export type ActivateRegimeInput = z.infer<typeof activateRegimeRequestSchema>;

export const activateRegimeResponseSchema = registry.register(
  "ActivateRegimeResponse",
  z.object({ regimeId: z.string(), exerciseCount: z.number().int() })
);
export type ActivateRegimeResponse = z.infer<typeof activateRegimeResponseSchema>;

export const restartReasonCodeSchema = z.enum(["GOALS_CHANGED", "STARTING_OVER", "OTHER"]);

export const restartRegimeRequestSchema = z.object({
  reasonCode: restartReasonCodeSchema,
  comment: z.string().max(1000).optional(),
});
export type RestartRegimeInput = z.infer<typeof restartRegimeRequestSchema>;

export const restartRegimeResponseSchema = registry.register(
  "RestartRegimeResponse",
  z.object({ success: z.literal(true) })
);
export type RestartRegimeResponse = z.infer<typeof restartRegimeResponseSchema>;

const regimeIdParamSchema = z.object({ regimeId: z.string() });

registry.registerPath({
  method: "get",
  path: "/regimes/{regimeId}",
  tags: ["regime"],
  summary: "Get a regime by id, with its exercise list and (if present) source preset",
  security: [{ bearerAuth: [] }],
  request: { params: regimeIdParamSchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: regimeResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Regime belongs to another user" },
    404: { description: "No regime with this id" },
  },
});

registry.registerPath({
  method: "post",
  path: "/regimes/{regimeId}/activate",
  tags: ["regime"],
  summary: "Activate a DRAFT regime — optionally with edited exercises, runs structural + clinical validation first",
  security: [{ bearerAuth: [] }],
  request: {
    params: regimeIdParamSchema,
    body: { content: { "application/json": { schema: activateRegimeRequestSchema } } },
  },
  responses: {
    200: { description: "Activated", content: { "application/json": { schema: activateRegimeResponseSchema } } },
    400: { description: "Not a DRAFT, or failed structural/clinical validation" },
    401: { description: "Not authenticated" },
    403: { description: "Regime belongs to another user" },
    404: { description: "No regime with this id" },
  },
});

registry.registerPath({
  method: "post",
  path: "/regimes/restart",
  tags: ["regime"],
  summary: "End the current user's active regime (self-service 'start over')",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: restartRegimeRequestSchema } } },
  },
  responses: {
    200: { description: "Ended", content: { "application/json": { schema: restartRegimeResponseSchema } } },
    400: { description: "No active regime to restart" },
    401: { description: "Not authenticated" },
  },
});
