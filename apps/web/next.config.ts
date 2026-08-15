import type { NextConfig } from "next";

// Clerk's hosted components need to load their own scripts/frames and talk
// to their API — CSP is scoped to that rather than a blanket 'self' so
// sign-in/sign-up don't break. *.clerk.accounts.dev covers the dev instance;
// add the prod frontend API domain here once a Clerk production instance /
// custom domain is set up (Clerk dashboard > Domains).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://img.clerk.com",
  "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com",
  "frame-src 'self' https://*.clerk.accounts.dev",
  "frame-ancestors 'none'",
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
