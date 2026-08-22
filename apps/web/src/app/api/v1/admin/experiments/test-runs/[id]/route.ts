import { z } from "zod";

import { getTestRunById } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ id: z.string() });

export const GET = withCors(
  withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
    const { id } = paramsSchema.parse(await routeCtx.params);
    return Response.json(await getTestRunById(ctx, { id }));
  })
);

export const OPTIONS = corsPreflight;
