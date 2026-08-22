import { z } from "zod";

import { runNextCycle } from "@rebound/api";
import { runNextCycleRequestSchema } from "@rebound/contracts";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ id: z.string() });

export const POST = withCors(
  withAdminOnlyAuth(async (ctx, req, routeCtx) => {
    const { id } = paramsSchema.parse(await routeCtx.params);
    const input = runNextCycleRequestSchema.parse(await req.json());
    return Response.json(await runNextCycle(ctx, { scenarioId: id, ...input }));
  })
);

export const OPTIONS = corsPreflight;
