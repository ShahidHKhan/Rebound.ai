import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createInnerContext } from "@rebound/api";

// apps/mobile's Expo dev server (and its `expo start --web` preview) is a
// genuinely different origin, so the browser enforces CORS for it — the web
// app's own same-origin requests are unaffected either way (browsers don't
// apply CORS to same-origin calls). Auth is a Bearer token (mobile) or
// same-origin cookies (web), never credentialed-cross-origin, so this only
// ever needs to allow known dev/preview origins, never a wildcard.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function withCors(response: Response, req: Request) {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
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
  return withCors(response, req);
}

export function OPTIONS(req: Request) {
  return withCors(new Response(null, { status: 204 }), req);
}

export { handler as GET, handler as POST };
