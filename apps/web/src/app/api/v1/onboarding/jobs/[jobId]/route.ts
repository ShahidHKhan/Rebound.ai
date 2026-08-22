import { z } from "zod";

import { RATE_LIMITS, getOnboardingJobStatus } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ jobId: z.string() });

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(
    withAuth(async (ctx, _req, routeCtx) => {
      const { jobId } = paramsSchema.parse(await routeCtx.params);
      return Response.json(await getOnboardingJobStatus(ctx, { jobId }));
    })
  )
);

export const OPTIONS = corsPreflight;
