/**
 * Fixed-window rate limiting, backed by the `rate_limits` table.
 *
 * Storage choice: Postgres, not Redis. In-memory counters are useless here —
 * every Vercel lambda instance would keep its own, so the effective limit is
 * (configured limit x instance count). Postgres is already on the path for
 * every request that matters, and the routes worth protecting are low-volume
 * and high-cost (a Flow A generation is several seconds of model time), so
 * one extra round trip is noise. It also means zero new infrastructure.
 *
 * If request volume ever makes the per-request write hurt, `consume()` is the
 * only function that needs replacing (@upstash/ratelimit is the drop-in);
 * `RateLimitResult` is deliberately shaped like what that library returns.
 */
import { prisma } from "@rebound/db";

import { ApiError } from "./errors";

export type RateLimitRule = {
  /** Namespace for the counter key — keeps unrelated routes from sharing a budget. */
  scope: string;
  /** Max requests permitted per identity per window. */
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** When the current window rolls over and the counter resets. */
  resetAt: Date;
  retryAfterSeconds: number;
};

/**
 * The rules every protected route draws from. Centralised so the whole
 * limiting policy is reviewable in one screen rather than scattered across
 * thirty route files.
 *
 * Budgets are set against *legitimate* usage, generously: a real user
 * onboards once, so 5/hour is already ~5x what anyone needs while still
 * capping a scripted abuser at 120 generations/day instead of unbounded.
 */
export const RATE_LIMITS = {
  /**
   * Flow A regime generation. THE expensive one — an authenticated user can
   * otherwise loop this and bill arbitrary model spend to the project, and
   * Clerk sign-up is free so "authenticated" is not a spend control.
   */
  onboarding: { scope: "onboarding", limit: 5, windowSeconds: 3600 },

  /**
   * Admin-triggered LLM work (test runs, scenario cycles). Higher than
   * onboarding because running experiments is the entire point of the admin
   * dashboard, but still bounded — an admin fat-fingering a loop shouldn't
   * cost hundreds of dollars.
   */
  adminLlm: { scope: "admin-llm", limit: 30, windowSeconds: 3600 },

  /**
   * Everyday writes (session logs, workout completion, settings). Well above
   * what the UI can produce by hand; catches scripted hammering only.
   */
  mutation: { scope: "mutation", limit: 60, windowSeconds: 60 },

  /** Reads. Loose — these are cheap, this is backstop protection only. */
  read: { scope: "read", limit: 300, windowSeconds: 60 },

  /**
   * Unauthenticated/pre-auth surface, keyed by IP rather than user id. Tight,
   * because there's no account to hold accountable.
   */
  anonymous: { scope: "anon", limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Atomically increment this identity's counter and report whether the request
 * fits inside the window.
 *
 * The whole check is a single INSERT ... ON CONFLICT DO UPDATE ... RETURNING,
 * which matters: a read-then-write pair would race between concurrent lambda
 * invocations and let a burst slip past the limit. Postgres serialises
 * conflicting upserts on the primary key, so the returned count is exact even
 * under parallel requests.
 *
 * Window boundaries come from the database clock (`now()`), never the Node
 * process clock, so instances with skewed clocks can't disagree about when a
 * window ends.
 *
 * Runs on the privileged `prisma` client, and must be called BEFORE withAuth
 * opens its RLS transaction — `rate_limits` has RLS enabled with no policies,
 * so the restricted rebound_app role cannot see it at all (by design).
 */
export async function consume(identity: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const key = `${rule.scope}:${identity}`;

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
      INSERT INTO rate_limits (key, count, "expiresAt")
      VALUES (${key}, 1, now() + (${rule.windowSeconds}::int * interval '1 second'))
      ON CONFLICT (key) DO UPDATE
        SET count = CASE
              WHEN rate_limits."expiresAt" <= now() THEN 1
              ELSE rate_limits.count + 1
            END,
            "expiresAt" = CASE
              WHEN rate_limits."expiresAt" <= now()
                THEN now() + (${rule.windowSeconds}::int * interval '1 second')
              ELSE rate_limits."expiresAt"
            END
      RETURNING count, "expiresAt"
    `;

    const row = rows[0];
    // Defensive: RETURNING on a successful upsert always yields a row, so an
    // empty result means something is deeply wrong. Fail open rather than
    // throw — see the catch below for the reasoning.
    if (!row) return allowUnchecked(rule);

    const resetAt = new Date(row.expiresAt);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

    return {
      allowed: row.count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - row.count),
      resetAt,
      retryAfterSeconds,
    };
  } catch (err) {
    // Fail OPEN. The tradeoff: failing closed would turn any blip in the
    // rate-limit write into a total API outage, and it buys very little here
    // because every route this guards needs the same database one line later
    // — if Postgres is genuinely down, the request fails regardless. Logged
    // loudly so a silently-degraded limiter is visible rather than assumed.
    console.error("Rate limit check failed — allowing request (fail-open):", err);
    return allowUnchecked(rule);
  }
}

function allowUnchecked(rule: RateLimitRule): RateLimitResult {
  return {
    allowed: true,
    limit: rule.limit,
    remaining: rule.limit,
    resetAt: new Date(Date.now() + rule.windowSeconds * 1000),
    retryAfterSeconds: rule.windowSeconds,
  };
}

/** The 429 thrown when {@link consume} reports a rejection. */
export function rateLimitError(result: RateLimitResult): ApiError {
  return new ApiError(
    "TOO_MANY_REQUESTS",
    `Rate limit exceeded. Try again in ${result.retryAfterSeconds}s.`
  );
}

/**
 * Delete counters whose window has already rolled over.
 *
 * Not required for correctness — consume() treats an expired row as a fresh
 * window — purely space reclamation, so it rides along with the existing
 * daily cron rather than earning a schedule of its own.
 */
export async function sweepExpired(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}
