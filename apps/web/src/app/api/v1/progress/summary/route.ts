import { RATE_LIMITS, getProgressSummary } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAuth(async (ctx) => Response.json(await getProgressSummary(ctx))))
);

export const OPTIONS = corsPreflight;
