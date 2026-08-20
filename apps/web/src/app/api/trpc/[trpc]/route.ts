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
  // auth() is resolved here, in the outer handler Next.js invokes directly
  // — not inside createContext below. createContext is called from deep
  // inside fetchRequestHandler's own internals (a generic, non-Next.js-aware
  // library), after it has already read/parsed the request body for batched
  // POSTs — that extra hop lost Next.js's per-request async-context tracking
  // that auth() depends on, so auth() intermittently returned a null userId
  // specifically for POST/mutation calls while GET/query calls (no body to
  // parse first) were unaffected. Confirmed live 2026-08-21: identical
  // cookie, GET resolves a real userId, the POST moments later doesn't.
  const { userId } = await auth();

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => createInnerContext({ userId }),
  });
  return withCors(response, req);
}

export function OPTIONS(req: Request) {
  return withCors(new Response(null, { status: 204 }), req);
}

export { handler as GET, handler as POST };
