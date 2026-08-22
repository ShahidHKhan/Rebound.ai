import { z } from "zod";

import { getRegimeById } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ regimeId: z.string() });

export const GET = withCors(
  withAuth(async (ctx, _req, routeCtx) => {
    const { regimeId } = paramsSchema.parse(await routeCtx.params);
    return Response.json(await getRegimeById(ctx, { regimeId }));
  })
);

export const OPTIONS = corsPreflight;
