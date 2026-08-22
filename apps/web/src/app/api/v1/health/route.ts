import { getHealth } from "@rebound/api";

import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(async () => Response.json(await getHealth()));

export const OPTIONS = corsPreflight;
