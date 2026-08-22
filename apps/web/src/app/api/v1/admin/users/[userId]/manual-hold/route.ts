import { z } from "zod";

import { RATE_LIMITS, setManualHold } from "@rebound/api";
import { setManualHoldRequestSchema } from "@rebound/contracts";

import { withAdminAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ userId: z.string() });

export const PATCH = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAdminAuth(async (ctx, req, routeCtx) => {
      const { userId } = paramsSchema.parse(await routeCtx.params);
      const input = setManualHoldRequestSchema.parse(await req.json());
      return Response.json(await setManualHold(ctx, { userId, ...input }));
    })
  )
);

export const OPTIONS = corsPreflight;
