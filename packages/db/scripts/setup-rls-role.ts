import crypto from "node:crypto";

import { prisma } from "../src";

// Restricted role for RLS-scoped tRPC requests — see packages/api/src/trpc.ts.
// Kept separate from the privileged DATABASE_URL role that owns the tables
// and that packages/agents/cron routes use directly (Postgres RLS never
// applies to a table's owning role, so that connection is unaffected no
// matter what policies get added here).
const ROLE_NAME = "rebound_app";

function generatePassword(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

async function main() {
  const password = generatePassword();

  const existing = await prisma.$queryRawUnsafe<{ rolname: string }[]>(
    `SELECT rolname FROM pg_roles WHERE rolname = '${ROLE_NAME}'`
  );

  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(`ALTER ROLE ${ROLE_NAME} WITH PASSWORD '${password}'`);
    console.log(`Role ${ROLE_NAME} already existed — password rotated.`);
  } else {
    await prisma.$executeRawUnsafe(`CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '${password}'`);
    console.log(`Role ${ROLE_NAME} created.`);
  }

  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE_NAME}`);
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE_NAME}`);
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE_NAME}`
  );

  // Supabase's pooler routes by a `<role>.<project-ref>` username (that's
  // why the existing role is "postgres.<ref>", not bare "postgres") — the
  // new role needs the same project-ref suffix or the pooler can't tell
  // which tenant database to connect to.
  const originalUrl = new URL(process.env.DATABASE_URL!);
  const projectRefSuffix = originalUrl.username.includes(".")
    ? "." + originalUrl.username.split(".").slice(1).join(".")
    : "";

  const rlsUrl = new URL(originalUrl.toString());
  rlsUrl.username = ROLE_NAME + projectRefSuffix;
  rlsUrl.password = password;

  console.log("\nDATABASE_URL_RLS=" + rlsUrl.toString());
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
