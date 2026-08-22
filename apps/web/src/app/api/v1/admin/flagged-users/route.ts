import { getFlaggedUsers } from "@rebound/api";

import { withAdminAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAdminAuth(async (ctx) => Response.json(await getFlaggedUsers(ctx))));

export const OPTIONS = corsPreflight;
