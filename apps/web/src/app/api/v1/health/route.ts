import { RATE_LIMITS, getHealth } from "@rebound/api";

import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.anonymous)(async () => Response.json(await getHealth()))
);

export const OPTIONS = corsPreflight;
