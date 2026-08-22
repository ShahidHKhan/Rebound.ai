import { z } from "zod";

import { registry } from "../registry";
import { riskTierSchema } from "./regime";
import { goalTypeSchema } from "./user";

const flaggedUserEntrySchema = z.object({
  user: z.object({
    id: z.string(),
    goalType: goalTypeSchema,
    riskTier: riskTierSchema,
    manualHold: z.boolean(),
    manualHoldReason: z.string().nullable(),
    createdAt: z.string().datetime(),
  }),
  reasons: z.array(z.string()),
  mostRecent: z.string().datetime(),
});

export const flaggedUsersResponseSchema = registry.register("AdminFlaggedUsers", z.array(flaggedUserEntrySchema));
export type FlaggedUsersResponse = z.infer<typeof flaggedUsersResponseSchema>;

export const setManualHoldRequestSchema = z.object({
  manualHold: z.boolean(),
  reason: z.string().max(500).optional(),
});
export type SetManualHoldInput = z.infer<typeof setManualHoldRequestSchema>;

export const setManualHoldResponseSchema = registry.register(
  "AdminSetManualHoldResponse",
  z.object({
    userId: z.string(),
    manualHold: z.boolean(),
    manualHoldReason: z.string().nullable(),
  })
);
export type SetManualHoldResponse = z.infer<typeof setManualHoldResponseSchema>;

export const adminMetricsResponseSchema = registry.register(
  "AdminMetrics",
  z.object({
    activationFunnel: z.object({
      totalUsers: z.number().int(),
      regimeGenerated: z.number().int(),
      regimeActivated: z.number().int(),
      loggedAtLeastOnce: z.number().int(),
    }),
    adverseEvents: z.object({
      flaggedSessionLogs: z.number().int(),
      escalationRollbacks: z.number().int(),
    }),
    flowFailures: z.object({
      flowAJobsTotal: z.number().int(),
      flowAJobsFailed: z.number().int(),
      flowBScheduledAdjustments: z.number().int(),
      flowBScheduledHolds: z.number().int(),
    }),
    reversalRate: z.object({
      totalAdjustmentEvents: z.number().int(),
      markedReversed: z.number().int(),
      note: z.string(),
    }),
  })
);
export type AdminMetricsResponse = z.infer<typeof adminMetricsResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/admin/flagged-users",
  tags: ["admin"],
  summary: "Users with an escalation rollback, a 'made it worse' flag, or a failed regime-generation job",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: flaggedUsersResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

const adminUserIdParamSchema = z.object({ userId: z.string() });

registry.registerPath({
  method: "patch",
  path: "/admin/users/{userId}/manual-hold",
  tags: ["admin"],
  summary: "Toggle manual hold for a user — both the escalation monitor and Flow B skip a held user",
  security: [{ bearerAuth: [] }],
  request: {
    params: adminUserIdParamSchema,
    body: { content: { "application/json": { schema: setManualHoldRequestSchema } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: setManualHoldResponseSchema } } },
    400: { description: "A reason is required to enable manual hold" },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/metrics",
  tags: ["admin"],
  summary: "Activation funnel, adverse events, flow failure counts, reversal rate",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: adminMetricsResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});
