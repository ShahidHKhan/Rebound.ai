import { z } from "zod";

import { RATE_LIMITS, getRegimeById } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ regimeId: z.string() });

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(
    withAuth(async (ctx, _req, routeCtx) => {
      const { regimeId } = paramsSchema.parse(await routeCtx.params);
      return Response.json(await getRegimeById(ctx, { regimeId }));
    })
  )
);

export const OPTIONS = corsPreflight;
