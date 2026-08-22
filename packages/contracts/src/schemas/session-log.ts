import { z } from "zod";

import { registry } from "../registry";

// Mirrors packages/clinical-rules/src/types.ts's EscalationAction/EscalationResult.
export const escalationActionSchema = z.enum(["none", "hold", "flag_for_review", "rollback"]);
export const escalationResultSchema = z.object({
  action: escalationActionSchema,
  reasons: z.array(z.string()),
});

export const sessionLogResponseSchema = registry.register(
  "SessionLog",
  z.object({
    id: z.string(),
    userId: z.string(),
    regimeVersionId: z.string(),
    loggedAt: z.string().datetime(),
    painScore: z.number().int(),
    // Flexible/typed field per goal_type (ROM degrees, rep max, RPE-based
    // strength, etc.) — genuinely polymorphic, no single concrete shape to
    // give it, and unused by either client today. Left as unknown rather
    // than forced into a shape that doesn't hold for every goal_type.
    mobilityStrengthIndicator: z.unknown().nullable(),
    completed: z.boolean(),
    perceivedExertion: z.number().int().nullable(),
    flag: z.boolean(),
  })
);
export type SessionLogResponse = z.infer<typeof sessionLogResponseSchema>;

export const sessionLogListResponseSchema = registry.register("SessionLogs", z.array(sessionLogResponseSchema));

export const createSessionLogRequestSchema = z.object({
  painScore: z.number().int().min(0).max(10),
  flag: z.boolean().default(false),
  perceivedExertion: z.number().int().min(0).max(10).optional(),
});
export type CreateSessionLogInput = z.infer<typeof createSessionLogRequestSchema>;

export const createSessionLogResponseSchema = registry.register(
  "CreateSessionLogResponse",
  z.object({
    sessionLogId: z.string(),
    escalation: escalationResultSchema,
  })
);
export type CreateSessionLogResponse = z.infer<typeof createSessionLogResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/session-logs",
  tags: ["session-log"],
  summary: "List the current user's session logs, most recent first",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: sessionLogListResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});

registry.registerPath({
  method: "post",
  path: "/session-logs",
  tags: ["session-log"],
  summary: "Log today's pain/exertion check-in — runs the real-time escalation monitor inline",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createSessionLogRequestSchema } } },
  },
  responses: {
    200: {
      description: "Logged",
      content: { "application/json": { schema: createSessionLogResponseSchema } },
    },
    400: { description: "Invalid input" },
    401: { description: "Not authenticated" },
    404: { description: "No active regime to log against" },
    409: { description: "Already logged today" },
  },
});
