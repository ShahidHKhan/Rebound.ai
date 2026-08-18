import { prisma } from "@rebound/db";

import { appRouter } from "../src/root";
import { createInnerContext } from "../src/context";

// Exercises the real tRPC router for the scenario-chaining feature — proves
// scenarios.start/runNextCycle/list/getById/delete all work through
// adminOnlyProcedure (not just the underlying packages/agents functions
// directly), and that deleting a scenario actually cascades to its
// TestRuns/LlmCalls.
const ADMIN_USER_ID = "test-admin-scenario-e2e";

async function upsertAdmin(id: string) {
  await prisma.user.upsert({
    where: { id },
    create: { id, goalType: "GENERAL_FITNESS", riskTier: "GENERAL", role: "ADMIN" },
    update: { role: "ADMIN" },
  });
}

async function main() {
  await upsertAdmin(ADMIN_USER_ID);
  const caller = appRouter.createCaller(createInnerContext({ userId: ADMIN_USER_ID }));

  const fixtures = await caller.adminExperiments.fixtures.list({ type: "ONBOARDING" });
  const fixture = fixtures.find((f) => f.id === "fixture-onboarding-general");
  if (!fixture) throw new Error("Expected seeded fixture-onboarding-general to exist");

  console.log("=== scenarios.start ===");
  // The LLM occasionally drafts a regime that legitimately fails validateRegime
  // (e.g. too many exercises for the tier) — that's the validator doing its
  // job, not a bug, so retry a few times rather than treating it as a hard
  // failure. The rest of this test needs a VALID cycle 0 to chain from.
  let started: Awaited<ReturnType<typeof caller.adminExperiments.scenarios.start>> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await caller.adminExperiments.scenarios.start({
      fixtureId: fixture.id,
      model: "claude-sonnet-5",
      name: `E2E test scenario (attempt ${attempt})`,
      description: "Created by scenario-e2e-test.ts",
    });
    console.log(`attempt ${attempt} — scenario: ${result.scenario.id}, cycle 0 status: ${result.testRun.status}`);
    if (result.testRun.status === "VALID") {
      started = result;
      break;
    }
    await caller.adminExperiments.scenarios.delete({ id: result.scenario.id });
  }
  if (!started) throw new Error("Cycle 0 didn't come back VALID after 3 attempts — worth a look, but likely just LLM variance");

  console.log("\n=== scenarios.runNextCycle x2 ===");
  const cycle1 = await caller.adminExperiments.scenarios.runNextCycle({
    scenarioId: started.scenario.id,
    painPattern: "PLATEAUING",
    days: 7,
    model: "claude-sonnet-5",
  });
  console.log(`cycle 1 status: ${cycle1.status}, diffFromPrevious entries: ${cycle1.diffFromPrevious?.length ?? "n/a"}`);

  if (cycle1.status === "VALID") {
    const cycle2 = await caller.adminExperiments.scenarios.runNextCycle({
      scenarioId: started.scenario.id,
      painPattern: "IMPROVING",
      days: 7,
      model: "claude-sonnet-5",
    });
    console.log(
      `cycle 2 status: ${cycle2.status}, diffFromPrevious entries: ${cycle2.diffFromPrevious?.length ?? "n/a"}, diffFromOriginal entries: ${cycle2.diffFromOriginal?.length ?? "n/a"}`
    );
  } else {
    console.log("Cycle 1 not VALID — skipping cycle 2 (matches runNextCycle's own guard behavior).");
  }

  console.log("\n=== scenarios.list ===");
  const list = await caller.adminExperiments.scenarios.list();
  const summary = list.find((s) => s.id === started.scenario.id);
  console.log(summary);

  console.log("\n=== scenarios.getById ===");
  const detail = await caller.adminExperiments.scenarios.getById({ id: started.scenario.id });
  console.log(`cycles: ${detail.cycles.length}, painTimeline points: ${detail.painTimeline.length}`);

  console.log("\n=== scenarios.delete + cascade check ===");
  // Capture ids before deletion — querying by scenarioId *after* deletion
  // would be vacuously "0 remaining" once the TestRun rows themselves are
  // gone, so this checks the specific LlmCall ids are actually gone by id.
  const testRunIdsBefore = (await prisma.testRun.findMany({ where: { scenarioId: started.scenario.id }, select: { id: true } })).map((t) => t.id);
  const llmCallIdsBefore = (await prisma.llmCall.findMany({ where: { testRunId: { in: testRunIdsBefore } }, select: { id: true } })).map((c) => c.id);
  console.log(`before delete — TestRuns: ${testRunIdsBefore.length}, LlmCalls: ${llmCallIdsBefore.length}`);

  await caller.adminExperiments.scenarios.delete({ id: started.scenario.id });

  const remainingTestRuns = await prisma.testRun.count({ where: { id: { in: testRunIdsBefore } } });
  const remainingLlmCalls = await prisma.llmCall.count({ where: { id: { in: llmCallIdsBefore } } });
  console.log(`after delete — remaining TestRuns: ${remainingTestRuns}, remaining LlmCalls: ${remainingLlmCalls}`);
  if (remainingTestRuns !== 0) throw new Error("Expected cascade delete to remove all TestRuns");
  if (remainingLlmCalls !== 0) throw new Error("Expected cascade delete to remove all LlmCalls");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
