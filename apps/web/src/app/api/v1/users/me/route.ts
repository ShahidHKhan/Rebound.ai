import { RATE_LIMITS, deleteMyAccount, getMe } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAuth(async (ctx) => Response.json(await getMe(ctx))))
);

export const DELETE = withCors(
  withRateLimit(RATE_LIMITS.mutation)(withAuth(async (ctx) => Response.json(await deleteMyAccount(ctx))))
);

export const OPTIONS = corsPreflight;
