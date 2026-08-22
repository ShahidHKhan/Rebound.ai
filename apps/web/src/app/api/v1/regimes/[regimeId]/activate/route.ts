import { z } from "zod";

import { RATE_LIMITS, activateRegime } from "@rebound/api";
import { activateRegimeRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ regimeId: z.string() });

export const POST = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAuth(async (ctx, req, routeCtx) => {
      const { regimeId } = paramsSchema.parse(await routeCtx.params);
      const input = activateRegimeRequestSchema.parse(await req.json());
      return Response.json(await activateRegime(ctx, { regimeId, ...input }));
    })
  )
);

export const OPTIONS = corsPreflight;
