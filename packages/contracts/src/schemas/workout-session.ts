import { z } from "zod";

import { registry } from "../registry";
import { regimeResponseSchema, sessionSlotSchema } from "./regime";
import { sessionLogResponseSchema } from "./session-log";

export const workoutSessionResponseSchema = registry.register(
  "WorkoutSession",
  z.object({
    id: z.string(),
    userId: z.string(),
    regimeVersionId: z.string(),
    date: z.string().datetime(),
    slot: sessionSlotSchema,
    scheduledAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
);
export type WorkoutSessionResponse = z.infer<typeof workoutSessionResponseSchema>;

// workoutSession.today's regime query never includes sourcePreset (only
// exerciseList) — a narrower shape than GET /regimes/{regimeId}'s full
// Regime, not just Regime-with-a-null-sourcePreset. Keep these as two
// distinct types rather than forcing one shape to cover both queries.
export const todayRegimeResponseSchema = regimeResponseSchema.omit({ sourcePreset: true });
export type TodayRegimeResponse = z.infer<typeof todayRegimeResponseSchema>;

export const workoutSessionTodayResponseSchema = registry.register(
  "WorkoutSessionToday",
  z.object({
    regime: todayRegimeResponseSchema.nullable(),
    sessions: z.array(workoutSessionResponseSchema),
    todaysLog: sessionLogResponseSchema.nullable(),
    streak: z.number().int(),
  })
);
export type WorkoutSessionTodayResponse = z.infer<typeof workoutSessionTodayResponseSchema>;

export const completeWorkoutSessionResponseSchema = registry.register(
  "CompleteWorkoutSessionResponse",
  z.object({
    workoutSessionId: z.string(),
    completedAt: z.string().datetime().nullable(),
  })
);
export type CompleteWorkoutSessionResponse = z.infer<typeof completeWorkoutSessionResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/workout-sessions/today",
  tags: ["workout-session"],
  summary: "Everything the Today screen needs: active regime, today's sessions, today's log, current streak",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: workoutSessionTodayResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

const workoutSessionIdParamSchema = z.object({ id: z.string() });

registry.registerPath({
  method: "post",
  path: "/workout-sessions/{id}/complete",
  tags: ["workout-session"],
  summary: "Mark a workout session complete",
  security: [{ bearerAuth: [] }],
  request: { params: workoutSessionIdParamSchema },
  responses: {
    200: {
      description: "Completed",
      content: { "application/json": { schema: completeWorkoutSessionResponseSchema } },
    },
    401: { description: "Not authenticated" },
    403: { description: "Session belongs to another user" },
    404: { description: "No workout session with this id" },
  },
});
