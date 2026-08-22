import { z } from "zod";

import { registry } from "../registry";

export const triggerTypeSchema = z.enum(["SCHEDULED_ADJUSTMENT", "ESCALATION_ROLLBACK"]);

export const adjustmentEventResponseSchema = registry.register(
  "AdjustmentEvent",
  z.object({
    id: z.string(),
    userId: z.string(),
    fromRegimeVersionId: z.string(),
    toRegimeVersionId: z.string(),
    triggeredAt: z.string().datetime(),
    triggerType: triggerTypeSchema,
    trailingWindowUsed: z.number().int(),
    rationale: z.string(),
    wasReversed: z.boolean(),
    fromRegime: z.object({ versionNumber: z.number().int() }),
    toRegime: z.object({ versionNumber: z.number().int() }),
  })
);
export type AdjustmentEventResponse = z.infer<typeof adjustmentEventResponseSchema>;

export const adjustmentEventListResponseSchema = registry.register(
  "AdjustmentEvents",
  z.array(adjustmentEventResponseSchema)
);

registry.registerPath({
  method: "get",
  path: "/adjustment-events",
  tags: ["adjustment-event"],
  summary: "The current user's adjustment events, most recent first",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: adjustmentEventListResponseSchema } } },
    401: { description: "Not authenticated" },
  },
});
