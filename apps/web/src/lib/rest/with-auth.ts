import { auth } from "@clerk/nextjs/server";

import { prisma, prismaRls, type Prisma } from "@rebound/db";

import { ApiError } from "@rebound/api";

import { errorResponse } from "./error-response";
import type { RouteContext, RouteHandler } from "./route-context";

export type AuthedCtx = { prisma: Prisma.TransactionClient; userId: string };
export type PrivilegedCtx = { prisma: typeof prisma; userId: string };

type AuthedHandler = (ctx: AuthedCtx, req: Request, routeCtx: RouteContext) => Promise<Response>;
type PrivilegedHandler = (ctx: PrivilegedCtx, req: Request, routeCtx: RouteContext) => Promise<Response>;

// RLS-scoped: mirrors packages/api/src/trpc.ts's protectedProcedure exactly.
// Every downstream query runs inside a transaction against the restricted
// rebound_app role, with app.user_id set via set_config() so Postgres itself
// enforces per-user isolation (packages/db/sql/rls-policies.sql) —
// independent of any WHERE clause a handler happens to write.
//
// auth() is resolved FIRST, before the handler (and therefore before any
// req.json() call) ever runs — do not move a body read above this. This
// mirrors the fix in apps/web/src/app/api/trpc/[trpc]/route.ts (confirmed
// live 2026-08-21): resolving auth() after the body is parsed loses Next's
// per-request async-context tracking and intermittently returns a null
// userId, on mutations only.
export function withAuth(handler: AuthedHandler): RouteHandler {
  return async (req: Request, routeCtx: RouteContext): Promise<Response> => {
    const { userId } = await auth();
    if (!userId) return errorResponse(new ApiError("UNAUTHORIZED"));

    try {
      return await prismaRls.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        return handler({ prisma: tx, userId }, req, routeCtx);
      });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

// Mirrors adminProcedure — protectedProcedure's RLS transaction, plus an
// app-logic role check and app.is_admin for cross-user RLS visibility. A
// leaked admin route alone must not be enough to expose data.
export function withAdminAuth(handler: AuthedHandler): RouteHandler {
  return withAuth(async (ctx, req, routeCtx) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") return errorResponse(new ApiError("FORBIDDEN"));

    await ctx.prisma.$executeRaw`SELECT set_config('app.is_admin', 'true', true)`;
    return handler(ctx, req, routeCtx);
  });
}

// Mirrors adminOnlyProcedure — admin-gated but deliberately NOT wrapped in an
// RLS transaction, unlike withAdminAuth. Reserved exclusively for routes
// touching non-user-owned tables (Exercise/Preset/LlmCall/TestFixture/
// TestRun/Scenario — no RLS policy on any of them). withAdminAuth holds open
// an interactive Prisma transaction for the whole handler body, which is
// fine for fast DB-only work but breaks the moment a handler does something
// genuinely slow — a real admin-triggered Flow A/B LLM call routinely
// exceeds Prisma's 5s default interactive-transaction timeout
// ("Transaction already closed", a real bug hit building the tRPC version of
// this admin dashboard). ctx.prisma here is the privileged global client —
// safe specifically because this wrapper is never meant to touch a
// user-owned table.
export function withAdminOnlyAuth(handler: PrivilegedHandler): RouteHandler {
  return async (req: Request, routeCtx: RouteContext): Promise<Response> => {
    const { userId } = await auth();
    if (!userId) return errorResponse(new ApiError("UNAUTHORIZED"));

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role !== "ADMIN") return errorResponse(new ApiError("FORBIDDEN"));

      return await handler({ prisma, userId }, req, routeCtx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
