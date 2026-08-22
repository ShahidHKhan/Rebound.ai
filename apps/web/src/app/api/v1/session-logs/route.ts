import { createSessionLog, listSessionLogs } from "@rebound/api";
import { createSessionLogRequestSchema } from "@rebound/contracts";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAuth(async (ctx) => Response.json(await listSessionLogs(ctx))));

export const POST = withCors(
  withAuth(async (ctx, req) => {
    const input = createSessionLogRequestSchema.parse(await req.json());
    return Response.json(await createSessionLog(ctx, input));
  })
);

export const OPTIONS = corsPreflight;
