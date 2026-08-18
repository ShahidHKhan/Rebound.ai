import { prisma } from "@rebound/db";

import { runFlowATestRun, runFlowBTestRun } from "../src/admin-test-runs";

const ADMIN_USER_ID = "test-admin-experiments";
const MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-5"];

async function main() {
  for (const model of MODELS) {
    console.log(`\n=== Flow A dry run — model: ${model} ===`);
    const fixtureA = await prisma.testFixture.findUniqueOrThrow({ where: { id: "fixture-onboarding-light-injury" } });
    const runA = await runFlowATestRun(fixtureA, model, ADMIN_USER_ID);
    console.log(`status: ${runA.status}`);
    console.log(JSON.stringify(runA.result, null, 2).slice(0, 500));

    console.log(`\n=== Flow B dry run — model: ${model} ===`);
    const fixtureB = await prisma.testFixture.findUniqueOrThrow({ where: { id: "fixture-adjustment-worsening" } });
    const runB = await runFlowBTestRun(fixtureB, model, ADMIN_USER_ID);
    console.log(`status: ${runB.status}`);
    console.log(JSON.stringify(runB.result, null, 2).slice(0, 500));
  }

  // Isolation check: confirm no real User/Regime/AdjustmentEvent row exists
  // for the fake admin id these test runs used.
  const leakedUser = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } });
  const leakedRegimes = await prisma.regime.count({ where: { userId: ADMIN_USER_ID } });
  console.log(`\nIsolation check — leaked User row: ${leakedUser !== null}, leaked Regime rows: ${leakedRegimes}`);

  const testRunCount = await prisma.testRun.count({ where: { createdByUserId: ADMIN_USER_ID } });
  const llmCallCount = await prisma.llmCall.count({ where: { source: "ADMIN_TEST", testRun: { createdByUserId: ADMIN_USER_ID } } });
  console.log(`TestRun rows created: ${testRunCount}, LlmCall rows logged: ${llmCallCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
