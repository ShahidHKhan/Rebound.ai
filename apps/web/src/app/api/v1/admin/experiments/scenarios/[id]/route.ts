import { z } from "zod";

import { deleteScenario, getScenarioById } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ id: z.string() });

export const GET = withCors(
  withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
    const { id } = paramsSchema.parse(await routeCtx.params);
    return Response.json(await getScenarioById(ctx, { id }));
  })
);

export const DELETE = withCors(
  withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
    const { id } = paramsSchema.parse(await routeCtx.params);
    return Response.json(await deleteScenario(ctx, { id }));
  })
);

export const OPTIONS = corsPreflight;
