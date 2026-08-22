import { listTestRuns, triggerTestRun } from "@rebound/api";
import { triggerTestRunRequestSchema } from "@rebound/contracts";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAdminOnlyAuth(async (ctx) => Response.json(await listTestRuns(ctx))));

export const POST = withCors(
  withAdminOnlyAuth(async (ctx, req) => {
    const input = triggerTestRunRequestSchema.parse(await req.json());
    return Response.json(await triggerTestRun(ctx, input));
  })
);

export const OPTIONS = corsPreflight;
