import { RATE_LIMITS, createFixture, listFixtures } from "@rebound/api";
import { createTestFixtureRequestSchema } from "@rebound/contracts";
import { z } from "zod";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";
import { withRateLimit } from "@/lib/rest/with-rate-limit";

const listQuerySchema = z.object({ type: z.enum(["ONBOARDING", "ADJUSTMENT"]).optional() });

export const GET = withCors(
  withRateLimit(RATE_LIMITS.read)(
    withAdminOnlyAuth(async (ctx, req) => {
      const query = listQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
      return Response.json(await listFixtures(ctx, query));
    })
  )
);

export const POST = withCors(
  withRateLimit(RATE_LIMITS.adminLlm)(
    withAdminOnlyAuth(async (ctx, req) => {
      const input = createTestFixtureRequestSchema.parse(await req.json());
      return Response.json(await createFixture(ctx, input));
    })
  )
);

export const OPTIONS = corsPreflight;
