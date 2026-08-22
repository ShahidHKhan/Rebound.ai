import { RATE_LIMITS, getAvailableModels } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAdminOnlyAuth(async () => Response.json(await getAvailableModels())))
);

export const OPTIONS = corsPreflight;
