import { RATE_LIMITS, getFlaggedUsers } from "@rebound/api";

import { withAdminAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAdminAuth(async (ctx) => Response.json(await getFlaggedUsers(ctx))))
);

export const OPTIONS = corsPreflight;
