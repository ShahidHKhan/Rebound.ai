import { z } from "zod";

import { deleteFixture } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

const paramsSchema = z.object({ id: z.string() });

export const DELETE = withCors(
  withAdminOnlyAuth(async (ctx, _req, routeCtx) => {
    const { id } = paramsSchema.parse(await routeCtx.params);
    return Response.json(await deleteFixture(ctx, { id }));
  })
);

export const OPTIONS = corsPreflight;
