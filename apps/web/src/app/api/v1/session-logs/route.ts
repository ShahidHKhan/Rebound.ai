import { RATE_LIMITS, createSessionLog, listSessionLogs } from "@rebound/api";
import { createSessionLogRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAuth(async (ctx) => Response.json(await listSessionLogs(ctx))))
);

export const POST = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAuth(async (ctx, req) => {
      const input = createSessionLogRequestSchema.parse(await req.json());
      return Response.json(await createSessionLog(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
