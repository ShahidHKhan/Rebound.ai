import { z } from "zod";

import { completeWorkoutSession } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ id: z.string() });

export const POST = withCors(
  withAuth(async (ctx, _req, routeCtx) => {
    const { id } = paramsSchema.parse(await routeCtx.params);
    return Response.json(await completeWorkoutSession(ctx, { workoutSessionId: id }));
  })
);

export const OPTIONS = corsPreflight;
