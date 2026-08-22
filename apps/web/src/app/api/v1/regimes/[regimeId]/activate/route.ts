import { z } from "zod";

import { activateRegime } from "@rebound/api";
import { activateRegimeRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ regimeId: z.string() });

export const POST = withCors(
  withAuth(async (ctx, req, routeCtx) => {
    const { regimeId } = paramsSchema.parse(await routeCtx.params);
    const input = activateRegimeRequestSchema.parse(await req.json());
    return Response.json(await activateRegime(ctx, { regimeId, ...input }));
  })
);

export const OPTIONS = corsPreflight;
