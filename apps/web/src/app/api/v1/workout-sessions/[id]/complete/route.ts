import { z } from "zod";

import { RATE_LIMITS, completeWorkoutSession } from "@rebound/api";
import { completeWorkoutSessionRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const paramsSchema = z.object({ id: z.string() });

// The existing "quick complete" callers send no body at all; only the
// guided session (apps/*/session/[slot]) sends { durationSeconds }. req.json()
// throws SyntaxError on an empty body, so an empty/absent body is treated
// as "no fields" rather than a parse failure.
async function parseOptionalBody(req: Request) {
  const text = await req.text();
  return completeWorkoutSessionRequestSchema.parse(text ? JSON.parse(text) : {});
}

export const POST = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAuth(async (ctx, req, routeCtx) => {
      const { id } = paramsSchema.parse(await routeCtx.params);
      const input = await parseOptionalBody(req);
      return Response.json(await completeWorkoutSession(ctx, { workoutSessionId: id, ...input }));
    })
  )
);

export const OPTIONS = corsPreflight;
