import { prisma } from "@rebound/db";

import { appRouter } from "../src/root";
import { createInnerContext } from "../src/context";

// Exercises the real tRPC router (adminProcedure's RLS transaction path,
// not just the underlying packages/agents functions directly) — proves the
// new LlmCall/TestFixture/TestRun tables are actually readable/writable by
// the RLS-scoped `rebound_app` role, and that a non-admin genuinely gets
// FORBIDDEN.
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

  const adminCaller = appRouter.createCaller(createInnerContext({ userId: ADMIN_USER_ID }));
  const nonAdminCaller = appRouter.createCaller(createInnerContext({ userId: NON_ADMIN_USER_ID }));

  console.log("=== availableModels ===");
  console.log(await adminCaller.adminExperiments.availableModels());

  console.log("\n=== fixtures.list ===");
  const fixtures = await adminCaller.adminExperiments.fixtures.list();
  console.log(`${fixtures.length} fixtures found`);
  const onboardingFixture = fixtures.find((f) => f.id === "fixture-onboarding-general");
  if (!onboardingFixture) throw new Error("Expected seeded fixture-onboarding-general to exist");

  console.log("\n=== testRuns.trigger (via real router, RLS-scoped) ===");
  const triggered = await adminCaller.adminExperiments.testRuns.trigger({
    fixtureId: onboardingFixture.id,
    model: "claude-haiku-4-5-20251001",
  });
  console.log(`status: ${triggered.status}, llmCalls: ${triggered.llmCalls.length}, exerciseNames keys: ${Object.keys(triggered.exerciseNames).length}`);

  console.log("\n=== testRuns.getById ===");
  const fetched = await adminCaller.adminExperiments.testRuns.getById({ id: triggered.id });
  console.log(`fetched status: ${fetched.status}`);

  console.log("\n=== testRuns.list ===");
  const history = await adminCaller.adminExperiments.testRuns.list();
  console.log(`${history.length} runs in history`);

  console.log("\n=== llmCalls.list ===");
  const calls = await adminCaller.adminExperiments.llmCalls.list({ limit: 10 });
  console.log(`${calls.length} calls returned`);

  console.log("\n=== non-admin should be FORBIDDEN ===");
  try {
    await nonAdminCaller.adminExperiments.fixtures.list();
    throw new Error("Expected FORBIDDEN, but the call succeeded");
  } catch (error) {
    const code = (error as { code?: string }).code;
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
