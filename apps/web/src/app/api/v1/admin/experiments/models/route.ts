import { getAvailableModels } from "@rebound/api";

import { withAdminOnlyAuth } from "@/lib/rest/with-auth";
import { corsPreflight, withCors } from "@/lib/rest/with-cors";

export const GET = withCors(withAdminOnlyAuth(async () => Response.json(await getAvailableModels())));

export const OPTIONS = corsPreflight;
