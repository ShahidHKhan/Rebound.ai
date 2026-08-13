import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createInnerContext } from "@rebound/api";

// apps/mobile's Expo dev server (and its `expo start --web` preview) is a
// genuinely different origin, so the browser enforces CORS for it — the web
// app's own same-origin requests are unaffected either way (browsers don't
// apply CORS to same-origin calls). Wildcard is fine here since auth is a
// Bearer token (mobile) or same-origin cookies (web), never
// credentialed-cross-origin; tighten to known origins before a real deploy.
function withCors(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

async function handler(req: Request) {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const { userId } = await auth();
      return createInnerContext({ userId });
    },
  });
  return withCors(response);
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export { handler as GET, handler as POST };
