import { RATE_LIMITS, submitCancellationFeedback } from "@rebound/api";
import { submitCancellationFeedbackRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const POST = withCors(
  withRateLimit(RATE_LIMITS.mutation)(
    withAuth(async (ctx, req) => {
      const input = submitCancellationFeedbackRequestSchema.parse(await req.json());
      return Response.json(await submitCancellationFeedback(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
