import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Named "proxy.ts" per the Next.js 16 rename of middleware.ts -> proxy.ts;
// the exported function is still what Clerk calls "middleware" in its own docs.
//
// Everything is protected by default except sign-in/sign-up, /api routes
// (tRPC procedures and cron routes already enforce their own auth), the
// legal pages (must be reachable without an account, e.g. by regulators or
// prospective users), and the public marketing site (the landing page and
// its sub-pages — a first-time visitor has no account yet by definition).
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/privacy",
  "/terms",
  "/how-it-works",
  "/safety",
  "/pricing",
  "/about",
  "/help",
]);

/**
 * A fresh CSP nonce per request.
 *
 * Web Crypto rather than node:crypto — this runs on the Edge runtime, where
 * Buffer and the Node crypto module aren't reliably available. 16 bytes is
 * the length the CSP spec recommends (128 bits of entropy, well past
 * guessable within a single response's lifetime).
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Nonce-based CSP, replacing the static `unsafe-inline`/`unsafe-eval`
 * script-src that used to live in next.config.ts.
 *
 * Why the change: `'unsafe-inline'` in script-src means any injected <script>
 * executes, which is precisely the thing CSP is supposed to stop — it made
 * the header close to decorative against XSS. A nonce only trusts scripts
 * this server actually emitted.
 *
 * Deliberately NOT using `'strict-dynamic'`. It looks like the stronger
 * choice and is what most CSP guides reach for, but it tells CSP Level 3
 * browsers to ignore the host allowlist entirely and trust only nonce'd
 * scripts plus whatever those load. Clerk renders its clerk.browser.js
 * <script> server-side WITHOUT a nonce (verified against a running dev
 * server 2026-08-22 — passing `nonce` to ClerkProvider nonces Next's inline
 * scripts but not Clerk's own external tag), so under 'strict-dynamic' a
 * modern browser would refuse to load Clerk at all and every sign-in would
 * break. Without it, the allowlist still governs external scripts and Clerk
 * loads normally.
 *
 * The XSS protection here comes from the nonce, not from 'strict-dynamic':
 * once a nonce is present, CSP3 browsers ignore `'unsafe-inline'` for inline
 * scripts, so an injected <script> without the nonce cannot run, and an
 * injected <script src> can only point at an allowlisted host.
 *
 * `'unsafe-inline'` is kept in script-src as a CSP2-only fallback:
 * any browser that understands the nonce ignores it per spec, so it costs
 * nothing modern and keeps very old browsers working rather than blank.
 *
 * `'unsafe-eval'` is dev-only. Next's React Refresh needs it for HMR; a
 * production bundle doesn't, and leaving it on would keep the largest
 * remaining hole open in the environment that matters.
 *
 * NOTE (carried over from next.config.ts, still outstanding):
 * *.clerk.accounts.dev covers the Clerk DEV instance only. Add the
 * production frontend API domain to script-src/connect-src/frame-src once a
 * Clerk production instance or custom domain exists (Clerk dashboard >
 * Domains), or sign-in breaks in production under this policy.
 *
 * style-src keeps 'unsafe-inline' unconditionally: this app styles almost
 * everything with inline `style={{...}}` props, which style-src governs.
 * Nonces can't cover style *attributes*, so removing it would mean
 * rewriting every component's styling — a much larger change with far less
 * security upside than the script-src fix.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";

  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "'unsafe-inline'",
      isDev ? "'unsafe-eval'" : "",
      "https://*.clerk.accounts.dev",
      "https://challenges.cloudflare.com",
      "https://*.protect.clerk.com",
    ]
      .filter(Boolean)
      .join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://img.clerk.com",
    "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
    "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Clerk spins up a background worker (from a blob: URL) for session
    // management/refresh. With no worker-src directive, CSP falls back to
    // script-src for worker creation — which doesn't allow blob: — so the
    // worker was silently blocked ("Creating a worker from 'blob:...' violates
    // ... worker-src' was not explicitly set, so script-src is used as a
    // fallback", confirmed live 2026-08-21). Without that worker, session
    // refresh degraded to whatever slower fallback path Clerk has: the first
    // few mutation attempts after sign-in failed with UNAUTHORIZED, then
    // started working ~30s later — exactly consistent with this.
    "worker-src 'self' blob:",
  ].join("; ");
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // The CSP goes on the REQUEST headers as well as the response, and that is
  // not redundant: Next.js emits its own inline bootstrap/streaming scripts
  // (self.__next_f.push(...)), and it discovers which nonce to stamp on them
  // by reading this request header. Drop it and every page breaks under the
  // policy the response advertises. x-nonce is the app-facing copy —
  // app/layout.tsx reads it to nonce ClerkProvider and its own inline script.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
