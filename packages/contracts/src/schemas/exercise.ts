import { z } from "zod";

import { registry } from "../registry";

// Mirrors packages/db/prisma/schema.prisma's ExerciseCategory/Equipment enums.
export const exerciseCategorySchema = z.enum(["MOBILITY", "STRENGTH", "STRETCH"]);
export const equipmentSchema = z.enum([
  "BODY_ONLY",
  "MACHINE",
  "OTHER",
  "FOAM_ROLL",
  "KETTLEBELLS",
  "DUMBBELL",
  "CABLE",
  "BARBELL",
  "BANDS",
  "MEDICINE_BALL",
  "EXERCISE_BALL",
  "EZ_CURL_BAR",
]);

// Prisma's Json? column type-checks as the broad JsonValue union (string |
// number | boolean | JsonObject | JsonArray | null) — but this app only ever
// seeds/reads one concrete shape here (packages/db/scripts/seed-exercises.ts),
// and both apps' readMedia() helpers already read it defensively at render
// time regardless. Modeling the real shape here — rather than an "any
// object" escape hatch — gives generated clients an actually useful type,
// and matches this migration's response-contract discipline better than
// papering over Json with z.unknown() (which, tried first, also confused
// zod-to-openapi into dropping this field's nullability/required-ness
// entirely — worth knowing if this schema needs to widen again).
export const exerciseMediaSchema = registry.register(
  "ExerciseMedia",
  z
    .object({
      instructions: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
    })
    .nullable()
);

export type ExerciseMedia = z.infer<typeof exerciseMediaSchema>;

export const exerciseResponseSchema = registry.register(
  "Exercise",
  z.object({
    id: z.string(),
    name: z.string(),
    category: exerciseCategorySchema,
    targetMuscleGroups: z.array(z.string()),
    difficultyLevel: z.number().int(),
    equipment: equipmentSchema.nullable(),
    contraindications: z.array(z.string()),
    progressionGroup: z.string().nullable(),
    media: exerciseMediaSchema,
    source: z.string(),
    externalId: z.string().nullable(),
  })
);

export type ExerciseResponse = z.infer<typeof exerciseResponseSchema>;

const exerciseIdParamSchema = z.object({ exerciseId: z.string() });

registry.registerPath({
  method: "get",
  path: "/exercises/{exerciseId}",
  tags: ["exercise"],
  // Exercise is shared library content, not user-owned — no ownership check
  // exists server-side (see packages/api/src/handlers/exercise.ts), but the
  // endpoint is still auth-gated like every other v1 route.
  summary: "Get a single exercise-library entry by id",
  security: [{ bearerAuth: [] }],
  request: { params: exerciseIdParamSchema },
  responses: {
    200: {
      description: "Exercise found",
      content: { "application/json": { schema: exerciseResponseSchema } },
    },
    401: { description: "Not authenticated" },
    404: { description: "No exercise with this id" },
  },
});
