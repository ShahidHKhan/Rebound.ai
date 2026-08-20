import type { NextConfig } from "next";

// Clerk's hosted components need to load their own scripts/frames and talk
// to their API — CSP is scoped to that rather than a blanket 'self' so
// sign-in/sign-up don't break. *.clerk.accounts.dev covers the dev instance;
// add the prod frontend API domain here once a Clerk production instance /
// custom domain is set up (Clerk dashboard > Domains).
//
// challenges.cloudflare.com (bot-protection CAPTCHA) and *.protect.clerk.com
// (abuse/fraud protection) were missing from script-src/frame-src — per
// Clerk's own CSP docs both are required unconditionally, not just when bot
// protection is explicitly configured. Without them the CAPTCHA script
// silently fails to load ("Failed to load the CAPTCHA script from
// Cloudflare" in the browser console, confirmed live 2026-08-21 during a
// sign-up), which can leave a session half-established — looks signed in
// client-side, but server-side session validation keeps failing. Added to
// connect-src too, defensively, since Turnstile can make its own
// fetch/XHR calls.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://img.clerk.com",
  "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com",
  "frame-ancestors 'none'",
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

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
