import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../src";

// Runs as the table-owning role (DATABASE_URL) — rebound_app doesn't own
// these tables, so it can't run CREATE POLICY / ALTER TABLE ... ENABLE ROW
// LEVEL SECURITY itself.
async function main() {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const sqlPath = path.join(dirname, "..", "sql", "rls-policies.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    console.log(statement.slice(0, 90).replace(/\s+/g, " ") + "...");
    await prisma.$executeRawUnsafe(statement);
  }

  console.log(`\nApplied ${statements.length} statements from rls-policies.sql.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
