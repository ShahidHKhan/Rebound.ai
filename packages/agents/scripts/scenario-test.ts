import { prisma } from "@rebound/db";

import { runFlowATestRun, runScenarioFlowBCycle } from "../src/admin-test-runs";
import { diffRegimes } from "../src/regime-diff";

const ADMIN_USER_ID = "test-admin-scenario";

async function main() {
  const fixture = await prisma.testFixture.findUniqueOrThrow({ where: { id: "fixture-onboarding-light-injury" } });

  const scenario = await prisma.scenario.create({
    data: { name: "Scenario smoke test", createdByUserId: ADMIN_USER_ID },
  });
  console.log(`Created scenario: ${scenario.id}`);

  console.log("\n=== Cycle 0 (Flow A) ===");
  const cycle0 = await runFlowATestRun(fixture, "claude-sonnet-5", ADMIN_USER_ID, { scenarioId: scenario.id });
  console.log(`status: ${cycle0.status}`);
  if (cycle0.status !== "VALID") {
    console.log(JSON.stringify(cycle0.result, null, 2));
    throw new Error("Expected cycle 0 to be VALID");
  }

  let previousTestRun = await prisma.testRun.findUniqueOrThrow({ where: { id: cycle0.testRunId } });

  const patterns = ["WORSENING", "IMPROVING", "CONTRADICTORY"] as const;
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]!;
    console.log(`\n=== Cycle ${i + 1} (Flow B, pattern: ${pattern}) ===`);
    const cycle = await runScenarioFlowBCycle(scenario, previousTestRun, pattern, 7, "claude-sonnet-5", ADMIN_USER_ID);
    console.log(`status: ${cycle.status}`);
    console.log(JSON.stringify(cycle.result, null, 2).slice(0, 400));

    if (cycle.status === "VALID") {
      const currentTestRun = await prisma.testRun.findUniqueOrThrow({ where: { id: cycle.testRunId } });
      const beforeRegime = (previousTestRun.resultJson as { draft?: unknown; regime?: unknown })?.draft ?? (previousTestRun.resultJson as { regime?: unknown })?.regime;
      const afterRegime = (currentTestRun.resultJson as { regime?: unknown })?.regime;
      const diff = diffRegimes(beforeRegime as never, afterRegime as never);
      console.log(`Diff from previous: ${diff.filter((d) => d.change !== "unchanged").length} changed entries`);
      previousTestRun = currentTestRun;
    } else {
      console.log("Cycle not VALID, stopping chain here.");
      break;
    }
  }

  // Isolation check.
  const leakedUser = await prisma.user.findUnique({ where: { id: ADMIN_USER_ID } });
  const leakedRegimes = await prisma.regime.count({ where: { userId: ADMIN_USER_ID } });
  console.log(`\nIsolation check — leaked User row: ${leakedUser !== null}, leaked Regime rows: ${leakedRegimes}`);

  const cycleCount = await prisma.testRun.count({ where: { scenarioId: scenario.id } });
  console.log(`TestRun cycles created for this scenario: ${cycleCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
