import { getNotificationTimes, updateNotificationTimes } from "@rebound/api";
import { updateNotificationTimesRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAuth(async (ctx) => Response.json(await getNotificationTimes(ctx))));

export const PATCH = withCors(
  withAuth(async (ctx, req) => {
    const input = updateNotificationTimesRequestSchema.parse(await req.json());
    return Response.json(await updateNotificationTimes(ctx, input));
  })
);

export const OPTIONS = corsPreflight;
