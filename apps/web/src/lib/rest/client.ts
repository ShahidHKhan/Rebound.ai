import createClient from "openapi-fetch";

import type { paths } from "./schema";

// Same same-origin trick as apps/web/src/lib/trpc/Provider.tsx's
// getBaseUrl() — relative URL in-browser (same-origin, Clerk's session
// cookie rides along automatically), absolute URL server-side (SSR/RSC has
// no implicit origin to resolve a relative fetch against).
function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const api = createClient<paths>({ baseUrl: `${getBaseUrl()}/api/v1` });
