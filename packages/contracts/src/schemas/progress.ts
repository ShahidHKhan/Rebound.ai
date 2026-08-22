import { z } from "zod";

import { registry } from "../registry";

// YYYY-MM-DD calendar-day keys (date-utils.ts's toDateKey) — never real Date
// objects at the API layer to begin with, so no Date/string conversion
// concern here at all, unlike most of this migration's response fields.
const painTrendPointSchema = z.object({ date: z.string(), painScore: z.number().int() });

export const progressSummaryResponseSchema = registry.register(
  "ProgressSummary",
  z.object({
    painTrend: z.array(painTrendPointSchema),
    adherencePct: z.number().int().nullable(),
    completedSessions: z.number().int(),
    totalSessions: z.number().int(),
    weeksActive: z.number().int(),
    streak: z.number().int(),
  })
);
export type ProgressSummaryResponse = z.infer<typeof progressSummaryResponseSchema>;

const streakCalendarDaySchema = z.object({ date: z.string(), completed: z.boolean() });

export const streakCalendarResponseSchema = registry.register(
  "StreakCalendar",
  z.object({
    days: z.array(streakCalendarDaySchema),
    streak: z.number().int(),
  })
);
export type StreakCalendarResponse = z.infer<typeof streakCalendarResponseSchema>;

const milestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

export const milestonesResponseSchema = registry.register("Milestones", z.array(milestoneSchema));
export type MilestonesResponse = z.infer<typeof milestonesResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/progress/summary",
  tags: ["progress"],
  summary: "Pain trend, adherence %, weeks active, current streak",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: progressSummaryResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "get",
  path: "/progress/streak-calendar",
  tags: ["progress"],
  summary: "Last 60 days, each flagged whether >=1 session was completed",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: streakCalendarResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "get",
  path: "/progress/milestones",
  tags: ["progress"],
  summary: "Derived achievement list — nothing persisted",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: milestonesResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});
