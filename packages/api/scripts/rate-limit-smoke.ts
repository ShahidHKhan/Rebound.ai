/**
 * Exercises the hand-written upsert in src/rate-limit.ts against a real
 * database — the counting, the limit boundary, per-identity isolation, and
 * window rollover. Kept as a script rather than a vitest suite to match this
 * package's existing *-e2e-test.ts convention.
 *
 * Run: pnpm --filter @rebound/api rate-limit-smoke
 */
import { prisma } from "@rebound/db";

import { consume, sweepExpired, type RateLimitRule } from "../src/rate-limit";

const RUN = `smoke-${Date.now()}`;
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

async function main() {
  const rule: RateLimitRule = { scope: RUN, limit: 3, windowSeconds: 60 };

  // Counts up and blocks past the limit.
  const verdicts: boolean[] = [];
  for (let i = 0; i < 5; i++) verdicts.push((await consume(`${RUN}-a`, rule)).allowed);
  check("allows exactly `limit` requests, then blocks", verdicts, [true, true, true, false, false]);

  // Remaining counts down and floors at zero.
  const fresh = await consume(`${RUN}-b`, rule);
  check("remaining decrements from limit", fresh.remaining, 2);

  // Identities do not share a budget.
  check("a separate identity starts fresh", (await consume(`${RUN}-c`, rule)).allowed, true);

  // Scopes do not share a budget either.
  const otherScope: RateLimitRule = { scope: `${RUN}-other`, limit: 1, windowSeconds: 60 };
  check("a separate scope starts fresh", (await consume(`${RUN}-a`, otherScope)).allowed, true);

  // An elapsed window resets the counter rather than staying blocked forever.
  const expiring: RateLimitRule = { scope: `${RUN}-exp`, limit: 1, windowSeconds: 1 };
  await consume(`${RUN}-d`, expiring);
  check("blocked while the window is open", (await consume(`${RUN}-d`, expiring)).allowed, false);
  await new Promise((r) => setTimeout(r, 1500));
  check("allowed again once the window rolls over", (await consume(`${RUN}-d`, expiring)).allowed, true);

  // Concurrent requests must not slip past the limit — the whole reason the
  // increment is a single atomic upsert instead of a read-then-write.
  //
  // Burst size is capped at 10 deliberately: Supabase's session-mode pooler
  // allows 15 clients, and a burst of 20 exhausts it. The overflow queries
  // fail, consume() fails open by design, and the check then measures pool
  // capacity rather than upsert atomicity. (Worth knowing in its own right —
  // under connection exhaustion this limiter lets traffic through rather than
  // shedding it. That is the deliberate tradeoff documented in rate-limit.ts,
  // and the point at which a Redis-backed limiter would start earning its
  // keep.)
  const burstRule: RateLimitRule = { scope: `${RUN}-burst`, limit: 5, windowSeconds: 60 };
  const burst = await Promise.all(Array.from({ length: 10 }, () => consume(`${RUN}-e`, burstRule)));
  check("10 parallel requests allow exactly 5", burst.filter((r) => r.allowed).length, 5);

  // Retry-After is always a usable positive number.
  const blocked = await consume(`${RUN}-e`, burstRule);
  check("blocked responses carry a positive Retry-After", blocked.retryAfterSeconds > 0, true);

  const swept = await sweepExpired();
  console.log(`\nsweepExpired() removed ${swept} expired row(s).`);

  await prisma.rateLimit.deleteMany({ where: { key: { contains: RUN } } });
  await prisma.$disconnect();

  console.log(failures === 0 ? "\nAll rate-limit checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
