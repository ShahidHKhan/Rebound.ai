import { z } from "zod";

import { RATE_LIMITS, deleteScenario, getScenarioById } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ id: z.string() });

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(
    withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
      const { id } = paramsSchema.parse(await routeCtx.params);
      return Response.json(await getScenarioById(ctx, { id }));
    })
  )
);

export const DELETE = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
      const { id } = paramsSchema.parse(await routeCtx.params);
      return Response.json(await deleteScenario(ctx, { id }));
    })
  )
);

export const OPTIONS = corsPreflight;
