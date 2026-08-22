import { RATE_LIMITS, listLlmCalls } from "@rebound/api";
import { listLlmCallsQuerySchema } from "@rebound/contracts";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(
    withAdminOnlyAuth(async (ctx, req) => {
      const query = listLlmCallsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
      return Response.json(await listLlmCalls(ctx, query));
    })
  )
);

export const OPTIONS = corsPreflight;
