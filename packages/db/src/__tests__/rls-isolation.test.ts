/**
 * Proves Postgres itself refuses cross-user reads and writes.
 *
 * This is the test the whole two-tier trust model rests on. Every handler in
 * packages/api is written to scope its own queries, but the entire point of
 * sql/rls-policies.sql is that a handler which *forgets* to still can't leak
 * anything. Nothing verified that claim until now — and RLS has a lot of ways
 * to be silently wrong: a policy attached to the wrong table, a USING clause
 * without a matching WITH CHECK (reads locked down, writes wide open), a
 * column name that Postgres case-folded into something that never matches, or
 * a table where RLS was simply never enabled.
 *
 * Deliberately exercised through `prismaRls` — the restricted rebound_app
 * role — because the table-owning role bypasses RLS entirely and would make
 * every assertion here pass for the wrong reason.
 *
 * Requires a live database (DATABASE_URL + DATABASE_URL_RLS). Skips cleanly
 * when they're absent so a plain `pnpm test` on a fresh clone stays green;
 * CI runs it wherever those secrets exist.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma, prismaRls } from "../index";

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_RLS);
const describeDb = hasDb ? describe : describe.skip;

// Namespaced so cleanup can target exactly these rows and never touch real
// data, even when pointed at a shared development database.
const RUN = `rls-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ALICE = `${RUN}-alice`;
const BOB = `${RUN}-bob`;

/** Runs `fn` exactly as withAuth does: restricted role, app.user_id set. */
async function asUser<T>(userId: string, fn: (tx: typeof prismaRls) => Promise<T>): Promise<T> {
  return prismaRls.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx as unknown as typeof prismaRls);
  });
}

/** Runs `fn` as withAdminAuth does: app.user_id plus the admin escape hatch. */
async function asAdmin<T>(userId: string, fn: (tx: typeof prismaRls) => Promise<T>): Promise<T> {
  return prismaRls.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.is_admin', 'true', true)`;
    return fn(tx as unknown as typeof prismaRls);
  });
}

describeDb("RLS cross-user isolation", () => {
  beforeAll(async () => {
    // describe.skip still executes suite-level hooks in Vitest, so the guard
    // has to be repeated here — without it a fresh clone with no database
    // fails in setup instead of skipping.
    if (!hasDb) return;

    for (const id of [ALICE, BOB]) {
      await prisma.user.create({
        data: {
          id,
          goalType: "INJURY_RECOVERY",
          riskTier: "GENERAL",
          conditionFlags: [],
          targetMovements: [],
          role: id === BOB ? "ADMIN" : "USER",
        },
      });
      const regime = await prisma.regime.create({
        data: { id: `${id}-regime`, userId: id, versionNumber: 1, createdBy: "AGENT" },
      });
      await prisma.sessionLog.create({
        data: { id: `${id}-log`, userId: id, regimeVersionId: regime.id, painScore: 3 },
      });
    }
  }, 30_000);

  afterAll(async () => {
    if (!hasDb) return;

    // Child rows first — FK constraints, same order as deleteMyAccount.
    await prisma.sessionLog.deleteMany({ where: { userId: { in: [ALICE, BOB] } } });
    await prisma.regime.deleteMany({ where: { userId: { in: [ALICE, BOB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ALICE, BOB] } } });
    await prisma.$disconnect();
    await prismaRls.$disconnect();
  }, 30_000);

  it("sees only its own rows on an unfiltered findMany", async () => {
    // No WHERE clause at all — exactly the mistake RLS exists to survive.
    const { users, regimes, logs } = await asUser(ALICE, async (tx) => ({
      users: await tx.user.findMany(),
      regimes: await tx.regime.findMany(),
      logs: await tx.sessionLog.findMany(),
    }));

    expect(users.map((u) => u.id)).toEqual([ALICE]);
    expect(regimes.every((r) => r.userId === ALICE)).toBe(true);
    expect(logs.every((l) => l.userId === ALICE)).toBe(true);
  });

  it("returns null when fetching another user's row by primary key", async () => {
    const found = await asUser(ALICE, async (tx) => ({
      user: await tx.user.findUnique({ where: { id: BOB } }),
      regime: await tx.regime.findUnique({ where: { id: `${BOB}-regime` } }),
      log: await tx.sessionLog.findUnique({ where: { id: `${BOB}-log` } }),
    }));

    // Knowing the exact id must not help — this is the leak that a missing
    // WHERE in a getById handler would otherwise cause.
    expect(found.user).toBeNull();
    expect(found.regime).toBeNull();
    expect(found.log).toBeNull();
  });

  it("cannot update another user's row", async () => {
    const affected = await asUser(ALICE, (tx) =>
      tx.sessionLog.updateMany({ where: { id: `${BOB}-log` }, data: { painScore: 10 } })
    );
    expect(affected.count).toBe(0);

    const bobsLog = await prisma.sessionLog.findUniqueOrThrow({ where: { id: `${BOB}-log` } });
    expect(bobsLog.painScore).toBe(3);
  });

  it("cannot delete another user's row", async () => {
    const affected = await asUser(ALICE, (tx) =>
      tx.sessionLog.deleteMany({ where: { id: `${BOB}-log` } })
    );
    expect(affected.count).toBe(0);
    expect(await prisma.sessionLog.count({ where: { id: `${BOB}-log` } })).toBe(1);
  });

  it("cannot forge a row owned by another user", async () => {
    // WITH CHECK, not USING — a policy with only USING blocks reads while
    // leaving inserts wide open, which is the subtler half of this to get
    // wrong.
    await expect(
      asUser(ALICE, (tx) =>
        tx.sessionLog.create({
          data: { id: `${RUN}-forged`, userId: BOB, regimeVersionId: `${BOB}-regime`, painScore: 1 },
        })
      )
    ).rejects.toThrow();

    expect(await prisma.sessionLog.count({ where: { id: `${RUN}-forged` } })).toBe(0);
  });

  it("scopes nested reads through a relation", async () => {
    // regime_exercises and workout_session_exercises have no userId of their
    // own and are scoped via an EXISTS subquery on the parent, so a join is a
    // genuinely distinct path worth covering.
    const regimes = await asUser(ALICE, (tx) => tx.regime.findMany({ include: { exerciseList: true } }));
    expect(regimes.every((r) => r.userId === ALICE)).toBe(true);
  });

  it("grants cross-user visibility only when app.is_admin is set", async () => {
    const asPlainUser = await asUser(BOB, (tx) => tx.user.findUnique({ where: { id: ALICE } }));
    expect(asPlainUser).toBeNull();

    const asAdminUser = await asAdmin(BOB, (tx) => tx.user.findUnique({ where: { id: ALICE } }));
    expect(asAdminUser?.id).toBe(ALICE);
  });

  it("keeps the shared exercise library readable", async () => {
    // The mirror-image failure: policies so tight that every screen showing
    // an exercise name breaks. preset_slots is included because it had no RLS
    // at all until 2026-08-22.
    await expect(
      asUser(ALICE, async (tx) => {
        await tx.exercise.findMany({ take: 1 });
        await tx.preset.findMany({ take: 1 });
        await tx.presetSlot.findMany({ take: 1 });
      })
    ).resolves.not.toThrow();
  });

  it("denies the restricted role access to internal tables", async () => {
    // llm_calls / rate_limits have RLS enabled with zero policies: default
    // deny. Postgres surfaces that as an empty result for the restricted
    // role, never as a leak.
    const rows = await asUser(ALICE, async (tx) => ({
      llmCalls: await tx.llmCall.findMany({ take: 1 }),
      rateLimits: await tx.rateLimit.findMany({ take: 1 }),
    }));

    expect(rows.llmCalls).toHaveLength(0);
    expect(rows.rateLimits).toHaveLength(0);
  });
});
