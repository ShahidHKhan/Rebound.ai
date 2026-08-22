import { RATE_LIMITS, getNotificationTimes, updateNotificationTimes } from "@rebound/api";
import { updateNotificationTimesRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(withAuth(async (ctx) => Response.json(await getNotificationTimes(ctx))))
);

export const PATCH = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAuth(async (ctx, req) => {
      const input = updateNotificationTimesRequestSchema.parse(await req.json());
      return Response.json(await updateNotificationTimes(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
