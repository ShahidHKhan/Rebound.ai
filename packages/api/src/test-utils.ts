import { prisma, prismaRls, prismaUnscoped, type Prisma, type UnscopedPrismaClient } from "@rebound/db";

import { ApiError } from "./errors";

// Mirrors apps/web/src/lib/rest/with-auth.ts's withAuth — same RLS-transaction
// setup (SELECT set_config('app.user_id', ...) inside a prismaRls
// transaction), minus the real Clerk auth() call, since these scripts
// already know/trust the userId they're testing as. Replaces the old
// createCaller(appRouter) pattern, which got this same RLS scoping for free
// from protectedProcedure's middleware — this is exact behavioral parity,
// not a new/different setup.
export async function withTestCtx<T>(
  userId: string,
  fn: (ctx: { prisma: Prisma.TransactionClient; userId: string }) => Promise<T>
): Promise<T> {
  return prismaRls.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn({ prisma: tx, userId });
  });
}

// Mirrors withAdminOnlyAuth — role-checked but deliberately NOT RLS-
// transaction-wrapped (privileged prisma directly), matching
// adminOnlyProcedure's original semantics for admin/experiments' non-RLS
// tables (LlmCall/TestFixture/TestRun/Scenario).
export async function withTestAdminOnlyCtx<T>(
  userId: string,
  fn: (ctx: { prisma: UnscopedPrismaClient; userId: string }) => Promise<T>
): Promise<T> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "ADMIN") {
    throw new ApiError("FORBIDDEN");
  }
  return fn({ prisma: prismaUnscoped, userId });
}
