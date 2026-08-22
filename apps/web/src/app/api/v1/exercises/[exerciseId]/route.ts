import { z } from "zod";

import { RATE_LIMITS, getExerciseById } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ exerciseId: z.string() });

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(
    withAuth(async (ctx, _req, routeCtx) => {
      const { exerciseId } = paramsSchema.parse(await routeCtx.params);
      const exercise = await getExerciseById(ctx, { exerciseId });
      return Response.json(exercise);
    })
  )
);

export const OPTIONS = corsPreflight;
