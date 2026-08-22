import { getProgressSummary } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAuth(async (ctx) => Response.json(await getProgressSummary(ctx))));

export const OPTIONS = corsPreflight;
