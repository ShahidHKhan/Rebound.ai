import { RATE_LIMITS, listTestRuns, triggerTestRun } from "@rebound/api";
import { triggerTestRunRequestSchema } from "@rebound/contracts";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAdminOnlyAuth(async (ctx) => Response.json(await listTestRuns(ctx))))
);

export const POST = withCors(
  withRateLimit(RATE_LIMITS.adminLlm)(
    withAdminOnlyAuth(async (ctx, req) => {
      const input = triggerTestRunRequestSchema.parse(await req.json());
      return Response.json(await triggerTestRun(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
