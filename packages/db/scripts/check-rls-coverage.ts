/**
 * Fails if any table in schema.prisma is missing from sql/rls-policies.sql.
 *
 * Why this exists: RLS in Postgres is opt-in *per table*. A brand-new Prisma
 * model ships with RLS disabled, and on Supabase "disabled" doesn't just mean
 * "no policies" — it means the table is readable through the auto-generated
 * PostgREST API by anyone with the anon key, regardless of whether this app's
 * own code ever calls that API. Supabase's linter caught this once already
 * (see the header of sql/rls-policies.sql, 2026-08-19), and `preset_slots`
 * had silently regressed the same way by 2026-08-22.
 *
 * Nothing in Prisma links a model to an RLS policy, so the only durable fix
 * is a mechanical check: every table gets a line in rls-policies.sql, even if
 * the decision recorded there is "enable RLS, write no policies, deny
 * everyone." This deliberately checks *coverage*, not correctness — it can't
 * tell a good policy from a bad one, but it guarantees a human made a
 * decision about every table.
 *
 * Run: pnpm --filter @rebound/db check:rls
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "prisma", "schema.prisma");
const policiesPath = join(here, "..", "sql", "rls-policies.sql");

const schema = readFileSync(schemaPath, "utf8");
const policies = readFileSync(policiesPath, "utf8");

/**
 * Model name -> table name. Prisma defaults the table name to the model name
 * and `@@map("...")` overrides it, so a model without @@map still resolves.
 * Blocks are split on the closing brace at column 0, which is how Prisma
 * formats them.
 */
function tablesInSchema(): Array<{ model: string; table: string }> {
  const found: Array<{ model: string; table: string }> = [];
  const modelBlock = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  for (const match of schema.matchAll(modelBlock)) {
    const model = match[1];
    const body = match[2];
    if (!model || body === undefined) continue;

    const mapped = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    found.push({ model, table: mapped?.[1] ?? model });
  }
  return found;
}

/** Tables that rls-policies.sql explicitly turns RLS on for. */
function tablesWithRlsEnabled(): Set<string> {
  const enabled = new Set<string>();
  const stmt = /ALTER\s+TABLE\s+([a-zA-Z_][\w]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

  for (const match of policies.matchAll(stmt)) {
    const table = match[1];
    if (table) enabled.add(table.toLowerCase());
  }
  return enabled;
}

const models = tablesInSchema();
const covered = tablesWithRlsEnabled();

if (models.length === 0) {
  console.error("::error::check-rls-coverage found no models in schema.prisma — the parser is probably broken.");
  process.exit(1);
}

const missing = models.filter(({ table }) => !covered.has(table.toLowerCase()));

// A policy for a table that no longer exists is a much softer problem than a
// table with no policy — it's dead SQL, not an exposure — so it warns rather
// than failing the build.
const schemaTables = new Set(models.map(({ table }) => table.toLowerCase()));
const orphaned = [...covered].filter((table) => !schemaTables.has(table));

if (orphaned.length > 0) {
  console.warn(
    `::warning::rls-policies.sql references ${orphaned.length} table(s) not in schema.prisma: ${orphaned.join(", ")}`
  );
}

if (missing.length > 0) {
  console.error(
    `::error::${missing.length} table(s) have no RLS decision recorded in packages/db/sql/rls-policies.sql:`
  );
  for (const { model, table } of missing) console.error(`  - ${table}  (model ${model})`);
  console.error("");
  console.error("On Supabase an RLS-disabled table is exposed through the auto-generated PostgREST API.");
  console.error("Add one of these to packages/db/sql/rls-policies.sql, then re-run:");
  console.error("");
  console.error("  # user-owned — scope every row to its owner:");
  console.error("  ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;");
  console.error("  CREATE POLICY <t>_isolation ON <t>");
  console.error(`    USING ("userId" = current_setting('app.user_id', true)`);
  console.error(`      OR current_setting('app.is_admin', true) = 'true');`);
  console.error("");
  console.error("  # shared library content — readable by every signed-in user:");
  console.error("  ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;");
  console.error("  CREATE POLICY <t>_public_read ON <t> FOR SELECT USING (true);");
  console.error("");
  console.error("  # internal/admin-only — enable RLS, write no policy, deny rebound_app entirely:");
  console.error("  ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;");
  process.exit(1);
}

console.log(`RLS coverage OK — all ${models.length} tables accounted for in rls-policies.sql.`);
