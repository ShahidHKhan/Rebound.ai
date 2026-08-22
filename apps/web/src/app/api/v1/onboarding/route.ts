import { submitOnboarding } from "@rebound/api";
import { onboardingSubmissionSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const POST = withCors(
  withAuth(async (ctx, req) => {
    const input = onboardingSubmissionSchema.parse(await req.json());
    return Response.json(await submitOnboarding(ctx, input));
  })
);

export const OPTIONS = corsPreflight;
