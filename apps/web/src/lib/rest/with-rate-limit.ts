import { auth } from "@clerk/nextjs/server";

import { consume, rateLimitError, type RateLimitRule } from "@rebound/api";

import { errorResponse } from "./error-response";
import type { RouteContext, RouteHandler } from "./route-context";

/**
 * Per-identity rate limiting for a route handler.
 *
 * COMPOSITION ORDER MATTERS — this belongs between withCors and withAuth:
 *
 *   export const POST = withCors(withRateLimit(RATE_LIMITS.onboarding)(withAuth(handler)));
 *
 * Outside withAuth, because the limiter writes to `rate_limits` on the
 * privileged client and withAuth's RLS transaction runs as the restricted
 * rebound_app role, which has no policy on that table and therefore cannot
 * touch it. Running inside would also hold the interactive transaction open
 * across the limiter's round trip for no reason.
 *
 * Inside withCors, so a 429 still carries CORS headers — otherwise the mobile
 * client sees an opaque network error instead of a readable "slow down".
 */
export function withRateLimit(rule: RateLimitRule) {
  return (handler: RouteHandler): RouteHandler => {
    return async (req: Request, routeCtx: RouteContext): Promise<Response> => {
      const identity = await resolveIdentity(req);
      const result = await consume(identity, rule);

      // Standard advisory headers, on allowed and rejected responses alike, so
      // a client can back off before being told to.
      const headers: Record<string, string> = {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
      };

      if (!result.allowed) {
        const res = errorResponse(rateLimitError(result));
        for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
        res.headers.set("Retry-After", String(result.retryAfterSeconds));
        return res;
      }

      const res = await handler(req, routeCtx);
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    };
  };
}

/**
 * Who to charge this request to: the Clerk user when there is one, otherwise
 * the client IP.
 *
 * User id is strongly preferred — an IP is shared by everyone behind a NAT or
 * a university network, so IP-keyed limits punish bystanders. IP is the
 * fallback for genuinely unauthenticated routes only.
 *
 * calling auth() here is safe and cheap: Clerk memoises it per request, so the
 * withAuth call downstream doesn't pay for it twice. It also respects the
 * ordering constraint documented in with-auth.ts — auth() resolves before any
 * handler reads req.json(), never after.
 */
async function resolveIdentity(req: Request): Promise<string> {
  try {
    const { userId } = await auth();
    if (userId) return `user:${userId}`;
  } catch {
    // Unauthenticated or outside a Clerk-aware context — fall through to IP.
  }
  return `ip:${clientIp(req)}`;
}

/**
 * Client IP, trusting only headers the platform sets itself.
 *
 * x-forwarded-for is client-controlled in general, but Vercel *overwrites*
 * rather than appends it at the edge, so on this deployment the leftmost
 * entry is the real client. x-vercel-forwarded-for and x-real-ip are set by
 * the platform and can't be spoofed from outside, so they're preferred.
 *
 * If this ever moves off Vercel, revisit — behind a proxy that appends
 * instead of overwrites, the leftmost value becomes attacker-controlled and
 * an attacker could rotate it to dodge IP-keyed limits entirely.
 */
function clientIp(req: Request): string {
  const platform = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip");
  if (platform) return platform.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  // Local dev, or a request that reached us with no proxy headers at all.
  // Everything unattributable shares one bucket — deliberately conservative:
  // better that anonymous local traffic throttles itself than that an
  // unidentifiable caller gets an unlimited budget.
  return "unknown";
}
