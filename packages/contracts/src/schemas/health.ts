import { z } from "zod";

import { registry } from "../registry";

export const healthResponseSchema = registry.register(
  "HealthResponse",
  z.object({
    ok: z.boolean(),
    timestamp: z.string().datetime().openapi({ example: "2026-08-21T12:00:00.000Z" }),
  })
);

export type HealthResponse = z.infer<typeof healthResponseSchema>;

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["health"],
  summary: "Liveness check — no auth required",
  responses: {
    200: {
      description: "Service is healthy",
      content: { "application/json": { schema: healthResponseSchema } },
    },
  },
});
