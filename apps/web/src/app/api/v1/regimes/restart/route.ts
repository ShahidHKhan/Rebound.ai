import { RATE_LIMITS, restartRegime } from "@rebound/api";
import { restartRegimeRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const POST = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAuth(async (ctx, req) => {
      const input = restartRegimeRequestSchema.parse(await req.json());
      return Response.json(await restartRegime(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
