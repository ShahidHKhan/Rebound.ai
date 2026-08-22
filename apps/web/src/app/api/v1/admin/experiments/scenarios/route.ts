import { listScenarios, startScenario } from "@rebound/api";
import { startScenarioRequestSchema } from "@rebound/contracts";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAdminOnlyAuth(async (ctx) => Response.json(await listScenarios(ctx))));

export const POST = withCors(
  withAdminOnlyAuth(async (ctx, req) => {
    const input = startScenarioRequestSchema.parse(await req.json());
    return Response.json(await startScenario(ctx, input));
  })
);

export const OPTIONS = corsPreflight;
