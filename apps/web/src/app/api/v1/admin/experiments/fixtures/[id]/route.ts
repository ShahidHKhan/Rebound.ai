import { z } from "zod";

import { RATE_LIMITS, deleteFixture } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ id: z.string() });

export const DELETE = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
      const { id } = paramsSchema.parse(await routeCtx.params);
      return Response.json(await deleteFixture(ctx, { id }));
    })
  )
);

export const OPTIONS = corsPreflight;
