import type { NextConfig } from "next";

// NOTE: Content-Security-Policy is deliberately NOT set here. It moved to
// src/proxy.ts, because a nonce-based policy has to be generated per request
// and next.config.ts headers are static. The headers below have no
// per-request component, so they stay — and staying here means they also
// cover the static assets that proxy.ts's matcher deliberately skips.
const securityHeaders = [
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
