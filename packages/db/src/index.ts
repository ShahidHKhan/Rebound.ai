import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaRls?: PrismaClient };

// Privileged connection — owns the tables, so Postgres RLS never applies to
// it regardless of what policies exist. Used by packages/agents and the
// cron routes, which have no single "current user" to scope to.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Restricted connection (rebound_app role — see scripts/setup-rls-role.ts),
// subject to RLS. Used only by packages/api's tRPC context, request-scoped
// via SET LOCAL app.user_id inside a transaction (see packages/api/src/trpc.ts).
export const prismaRls =
  globalForPrisma.prismaRls ??
  new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_RLS } } });

/**
 * Tables with no per-user ownership: shared exercise library content,
 * internal experiment records, and rate-limit counters. Kept in sync with
 * packages/db/sql/rls-policies.sql, where each of these is either
 * public-read or full default-deny — none of them carry a userId.
 */
export const NON_USER_OWNED_MODELS = [
  "exercise",
  "preset",
  "presetExercise",
  "presetSlot",
  "llmCall",
  "testFixture",
  "testRun",
  "scenario",
  "rateLimit",
] as const;

export type NonUserOwnedModel = (typeof NON_USER_OWNED_MODELS)[number];

/** The privileged client narrowed to non-user-owned tables. */
export type UnscopedPrismaClient = Pick<PrismaClient, NonUserOwnedModel>;

const NON_USER_OWNED = new Set<string>(NON_USER_OWNED_MODELS);

/**
 * The privileged client, restricted to tables that have no owner.
 *
 * This exists because withAdminOnlyAuth (apps/web/src/lib/rest/with-auth.ts)
 * deliberately runs OUTSIDE an RLS transaction — it has to, since an
 * admin-triggered Flow A/B call routinely outlives Prisma's 5s interactive
 * transaction timeout. That makes it the one authenticated path in the app
 * with no database-level guard behind it, so "only touches non-user tables"
 * had been a promise kept by a code comment alone.
 *
 * Now it's enforced twice over:
 *   - at compile time, because UnscopedPrismaClient simply has no `user`,
 *     `regime`, `sessionLog`, ... property to reach for; and
 *   - at runtime by this Proxy, which also blocks the escape hatches the
 *     type system can't see through — $queryRaw, $executeRaw and
 *     $transaction would otherwise reach any table in the database.
 *
 * Anything genuinely needing user-owned data should use withAuth/
 * withAdminAuth and get RLS, rather than widening this list.
 */
export const prismaUnscoped: UnscopedPrismaClient = new Proxy(prisma, {
  get(target, prop, receiver) {
    // Not a thenable — without this, `await`ing the proxy by accident would
    // trip the trap below and throw something baffling.
    if (prop === "then") return undefined;
    if (typeof prop === "symbol") return Reflect.get(target, prop, receiver);
    if (NON_USER_OWNED.has(prop)) return Reflect.get(target, prop, receiver);

    throw new Error(
      `prismaUnscoped: "${String(prop)}" is not reachable from an admin-only route. ` +
        `This client is restricted to non-user-owned tables (${NON_USER_OWNED_MODELS.join(", ")}) ` +
        `because withAdminOnlyAuth runs outside RLS. Use withAuth or withAdminAuth for user data.`
    );
  },
}) as UnscopedPrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRls = prismaRls;
}

export * from "@prisma/client";
