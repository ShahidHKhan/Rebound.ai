import { RATE_LIMITS, submitOnboarding } from "@rebound/api";
import { onboardingSubmissionSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

export const POST = withCors(
  withRateLimit(RATE_LIMITS.onboarding)(
    withAuth(async (ctx, req) => {
      const input = onboardingSubmissionSchema.parse(await req.json());
      return Response.json(await submitOnboarding(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
