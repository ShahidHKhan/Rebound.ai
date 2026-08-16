import { initTRPC, TRPCError } from "@trpc/server";
import { prismaRls } from "@rebound/db";
import superjson from "superjson";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // tRPC forwards error.message to the client for every error, including
  // uncaught ones (Prisma/Anthropic SDK exceptions land here with their raw
  // internal text) — unlike `stack`, that isn't dev-gated by default. Mask
  // it in production for anything we didn't deliberately throw as a
  // TRPCError with its own safe message; log the real cause server-side.
  errorFormatter({ shape, error }) {
    if (error.code === "INTERNAL_SERVER_ERROR" && process.env.NODE_ENV === "production") {
      console.error("Unhandled tRPC error:", error.cause ?? error);
      return { ...shape, message: "Something went wrong. Please try again." };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// RLS-scoped: every downstream query runs inside a transaction against the
// restricted `rebound_app` role, with app.user_id set via set_config() so
// Postgres itself enforces per-user isolation (packages/db/sql/rls-policies.sql)
// — independent of whatever WHERE clause a procedure happens to write. This
// swaps ctx.prisma from the privileged global client to the transaction
// client for every procedure built on this one.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const userId = ctx.userId;

  return prismaRls.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return next({ ctx: { ...ctx, userId, prisma: tx } });
  });
});

// Enforced here as a second, app-logic check alongside RLS at the database
// layer — a leaked admin route alone must not be enough to expose data.
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  // Same transaction protectedProcedure already opened — grants this
  // request's RLS policies cross-user visibility for the rest of the chain.
  await ctx.prisma.$executeRaw`SELECT set_config('app.is_admin', 'true', true)`;

  return next({ ctx });
});
