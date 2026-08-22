import { deleteMyAccount, getMe } from "@rebound/api";

import { withAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAuth(async (ctx) => Response.json(await getMe(ctx))));

export const DELETE = withCors(withAuth(async (ctx) => Response.json(await deleteMyAccount(ctx))));

export const OPTIONS = corsPreflight;
