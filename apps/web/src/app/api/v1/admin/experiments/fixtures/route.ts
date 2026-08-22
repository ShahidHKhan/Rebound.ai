import { createFixture, listFixtures } from "@rebound/api";
import { createTestFixtureRequestSchema } from "@rebound/contracts";
import { z } from "zod";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const listQuerySchema = z.object({ type: z.enum(["ONBOARDING", "ADJUSTMENT"]).optional() });

export const GET = withCors(
  withAdminOnlyAuth(async (ctx, req) => {
    const query = listQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return Response.json(await listFixtures(ctx, query));
  })
);

export const POST = withCors(
  withAdminOnlyAuth(async (ctx, req) => {
    const input = createTestFixtureRequestSchema.parse(await req.json());
    return Response.json(await createFixture(ctx, input));
  })
);

export const OPTIONS = corsPreflight;
