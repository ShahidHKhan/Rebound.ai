import { prisma } from "@rebound/db";

import { ApiError } from "../src/errors";
import {
  getAvailableModels,
  getTestRunById,
  listFixtures,
  listLlmCalls,
  listTestRuns,
  triggerTestRun,
} from "../src/handlers/admin-experiments";
import { withTestAdminOnlyCtx } from "../src/test-utils";

// Exercises the real handler functions through withTestAdminOnlyCtx (the
// same role-check + privileged-client path withAdminOnlyAuth uses in
// production) — proves the LlmCall/TestFixture/TestRun tables are actually
// readable/writable, and that a non-admin genuinely gets rejected.
const ADMIN_USER_ID = "test-admin-experiments-e2e";
const NON_ADMIN_USER_ID = "test-user-experiments-e2e-nonadmin";

async function upsertUser(id: string, role: "ADMIN" | "USER") {
  await prisma.user.upsert({
    where: { id },
    create: { id, goalType: "GENERAL_FITNESS", riskTier: "GENERAL", role },
    update: { role },
  });
}

async function main() {
  await upsertUser(ADMIN_USER_ID, "ADMIN");
  await upsertUser(NON_ADMIN_USER_ID, "USER");

  console.log("=== availableModels ===");
  console.log(await withTestAdminOnlyCtx(ADMIN_USER_ID, () => getAvailableModels()));

  console.log("\n=== fixtures.list ===");
  const fixtures = await withTestAdminOnlyCtx(ADMIN_USER_ID, (ctx) => listFixtures(ctx, {}));
  console.log(`${fixtures.length} fixtures found`);
  const onboardingFixture = fixtures.find((f) => f.id === "fixture-onboarding-general");
  if (!onboardingFixture) throw new Error("Expected seeded fixture-onboarding-general to exist");

  console.log("\n=== testRuns.trigger (via the real handler, admin-role-checked) ===");
  const triggered = await withTestAdminOnlyCtx(ADMIN_USER_ID, (ctx) =>
    triggerTestRun(ctx, { fixtureId: onboardingFixture.id, model: "claude-haiku-4-5-20251001" })
  );
  console.log(`status: ${triggered.status}, llmCalls: ${triggered.llmCalls.length}, exerciseNames keys: ${Object.keys(triggered.exerciseNames).length}`);

  console.log("\n=== testRuns.getById ===");
  const fetched = await withTestAdminOnlyCtx(ADMIN_USER_ID, (ctx) => getTestRunById(ctx, { id: triggered.id }));
  console.log(`fetched status: ${fetched.status}`);

  console.log("\n=== testRuns.list ===");
  const history = await withTestAdminOnlyCtx(ADMIN_USER_ID, (ctx) => listTestRuns(ctx));
  console.log(`${history.length} runs in history`);

  console.log("\n=== llmCalls.list ===");
  const calls = await withTestAdminOnlyCtx(ADMIN_USER_ID, (ctx) => listLlmCalls(ctx, { limit: 10 }));
  console.log(`${calls.length} calls returned`);

  console.log("\n=== non-admin should be FORBIDDEN ===");
  try {
    await withTestAdminOnlyCtx(NON_ADMIN_USER_ID, (ctx) => listFixtures(ctx, {}));
    throw new Error("Expected FORBIDDEN, but the call succeeded");
  } catch (error) {
    const code = error instanceof ApiError ? error.code : undefined;
    console.log(`non-admin call rejected with code: ${code}`);
    if (code !== "FORBIDDEN") throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
