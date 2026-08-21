import createClient from "openapi-fetch";

import type { paths } from "./schema";

// Same-origin trick from the web client doesn't apply on-device — the
// backend host must be reachable over the network, not localhost. Same env
// var apps/mobile/lib/trpc.tsx already uses.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not set");
}

export function createApiClient(getToken: () => Promise<string | null>) {
  const client = createClient<paths>({ baseUrl: `${API_URL}/api/v1` });

  // Clerk session tokens are short-lived — fetched fresh per-request here
  // (not a passive cookie like web), same reasoning as lib/trpc.tsx's
  // headers() callback.
  client.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });

  return client;
}
