import { prisma } from "@rebound/db";

import { appRouter } from "../src/root";
import { createInnerContext } from "../src/context";

const TEST_USER_ID = "test-user-restart-regime";

const SUBMISSION = {
  answers: {
    age: 30,
    goalType: "MOBILITY" as const,
    conditionFlags: [],
    injurySeverity: "none" as const,
    redFlags: {
      severeSuddenPain: false,
      numbnessOrTingling: false,
      recentTrauma: false,
      recentSurgery: false,
      pregnancyRelated: false,
      cardiacSymptomsWithExertion: false,
    },
  },
  targetMovement: "touching toes without knee bend",
  symptomsText: "Mild stiffness in lower back and hamstrings, no sharp pain.",
  lifestyleContextText: "Busy office worker, sits most of the day, ~20 minutes free per session.",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJob(caller: ReturnType<typeof appRouter.createCaller>, jobId: string) {
  let job = await caller.onboarding.getJobStatus({ jobId });
  while (job.status === "PENDING") {
    await sleep(1500);
    job = await caller.onboarding.getJobStatus({ jobId });
  }
  if (job.status !== "COMPLETE" || !job.resultRegimeId) {
    throw new Error(`Job did not complete successfully: ${JSON.stringify(job)}`);
  }
  return job.resultRegimeId;
}

async function main() {
  await prisma.workoutSession.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.regimeGenerationJob.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.adjustmentEvent.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.sessionLog.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.regime.deleteMany({ where: { userId: TEST_USER_ID } });

  const caller = appRouter.createCaller(createInnerContext({ userId: TEST_USER_ID }));

  // 1. First onboarding — should succeed normally.
  const submit1 = await caller.onboarding.submit(SUBMISSION);
  console.log("submit #1 ->", submit1.status);
  if (submit1.status !== "job_created") throw new Error("Expected job_created on first submit");
  const regimeId1 = await waitForJob(caller, submit1.jobId);
  await caller.regime.activate({ regimeId: regimeId1 });
  console.log("regime v1 activated:", regimeId1);

  // 2. Second onboarding, regime v1 still ACTIVE and <7 days old — should
  // be blocked by the cooldown guard, not silently generate another one.
  const submit2 = await caller.onboarding.submit(SUBMISSION);
  console.log("submit #2 (expect cooldown_active) ->", submit2.status);
  if (submit2.status !== "cooldown_active") {
    throw new Error(`Expected cooldown_active, got ${submit2.status}`);
  }

  // 3. Restart — ends v1 explicitly.
  const restartResult = await caller.regime.restart({ reasonCode: "STARTING_OVER", comment: "testing" });
  console.log("restart ->", restartResult);
  const v1AfterRestart = await prisma.regime.findUniqueOrThrow({ where: { id: regimeId1 } });
  console.log("v1 status after restart (expect ENDED):", v1AfterRestart.status, "| endReason:", v1AfterRestart.endReason);
  if (v1AfterRestart.status !== "ENDED") throw new Error("Expected v1 to be ENDED after restart");

  // 4. Third onboarding — cooldown should be cleared now that v1 is ENDED,
  // not ACTIVE.
  const submit3 = await caller.onboarding.submit(SUBMISSION);
  console.log("submit #3 after restart (expect job_created) ->", submit3.status);
  if (submit3.status !== "job_created") {
    throw new Error(`Expected job_created after restart, got ${submit3.status}`);
  }
  const regimeId2 = await waitForJob(caller, submit3.jobId);
  await caller.regime.activate({ regimeId: regimeId2 });
  console.log("regime v2 activated:", regimeId2);

  // 5. Exactly one ACTIVE regime should exist now — confirms the
  // regime.activate supersede fix closed the "two actives" gap, not just
  // that restart's explicit ENDED path works.
  const allRegimes = await prisma.regime.findMany({
    where: { userId: TEST_USER_ID },
    select: { id: true, versionNumber: true, status: true },
    orderBy: { versionNumber: "asc" },
  });
  console.log("all regimes for test user:", allRegimes);
  const activeCount = allRegimes.filter((r) => r.status === "ACTIVE").length;
  if (activeCount !== 1) {
    throw new Error(`Expected exactly 1 ACTIVE regime, found ${activeCount}`);
  }

  console.log("\nAll checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
