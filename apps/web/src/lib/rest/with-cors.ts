import type { RouteHandler } from "./route-context";

// Mirrors apps/web/src/app/api/trpc/[trpc]/route.ts's CORS policy exactly —
// allowlist-based, never a wildcard (auth is a Bearer token for mobile or a
// same-origin cookie for web, never credentialed cross-origin). REST adds
// PATCH/DELETE beyond tRPC's GET/POST-only surface.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function applyCorsHeaders(response: Response, req: Request): Response {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// Composable — wraps a route handler (public, or already withAuth/
// withAdminAuth-wrapped) so its response always carries this same CORS
// policy. Compose as the outermost wrapper: withCors(withAuth(handler)).
export function withCors(handler: RouteHandler): RouteHandler {
  return async (req, routeCtx) => applyCorsHeaders(await handler(req, routeCtx), req);
}

export function corsPreflight(req: Request): Response {
  return applyCorsHeaders(new Response(null, { status: 204 }), req);
}
