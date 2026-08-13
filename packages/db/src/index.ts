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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRls = prismaRls;
}

export * from "@prisma/client";
