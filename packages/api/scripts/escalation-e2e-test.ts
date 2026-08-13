import { prisma } from "@rebound/db";
import { runFlowBForUser } from "@rebound/agents";

import { appRouter } from "../src/root";
import { createInnerContext } from "../src/context";

const TEST_USER_ID = "test-user-escalation-e2e";

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

async function seedTrailingLogs(userId: string, regimeId: string, painScores: number[]) {
  const now = new Date();
  for (const [i, painScore] of painScores.entries()) {
    const daysAgo = painScores.length - i;
    const loggedAt = new Date(now);
    loggedAt.setDate(now.getDate() - daysAgo);
    await prisma.sessionLog.create({
      data: { userId, regimeVersionId: regimeId, loggedAt, painScore, completed: true, flag: false },
    });
  }
}

async function main() {
  await prisma.workoutSession.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.adjustmentEvent.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.sessionLog.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.regime.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.regimeGenerationJob.deleteMany({ where: { userId: TEST_USER_ID } });

  const caller = appRouter.createCaller(createInnerContext({ userId: TEST_USER_ID }));

  // Get a v1 ACTIVE regime via the real submit -> poll -> activate chain.
  const submitResult = await caller.onboarding.submit(SUBMISSION);
  if (submitResult.status !== "job_created") throw new Error("Expected a job");

  let job = await caller.onboarding.getJobStatus({ jobId: submitResult.jobId });
  while (job.status === "PENDING") {
    await sleep(1500);
    job = await caller.onboarding.getJobStatus({ jobId: submitResult.jobId });
  }
  if (job.status !== "COMPLETE" || !job.resultRegimeId) throw new Error("Job did not complete");

  await caller.regime.activate({ regimeId: job.resultRegimeId });
  console.log("v1 active regime:", job.resultRegimeId);

  // Produce a real v2 via Flow B (improving trend -> progress), so there's
  // an actual parent regime for the escalation monitor to roll back to.
  await seedTrailingLogs(TEST_USER_ID, job.resultRegimeId, [6, 6, 5, 5, 4, 3, 2]);
  const flowBResult = await runFlowBForUser(TEST_USER_ID);
  console.log("Flow B result:", flowBResult);
  if (flowBResult.status !== "adjusted") throw new Error("Expected Flow B to adjust");

  const beforeActive = await prisma.regime.findFirst({ where: { userId: TEST_USER_ID, status: "ACTIVE" } });
  console.log("active regime before escalation:", beforeActive?.id, beforeActive?.versionNumber);

  // Now log a red (7-10) pain score — should trigger an immediate rollback.
  const logResult = await caller.sessionLog.create({ painScore: 8, flag: false });
  console.log("sessionLog.create ->", logResult);

  const afterActive = await prisma.regime.findFirst({ where: { userId: TEST_USER_ID, status: "ACTIVE" } });
  console.log("active regime after escalation:", afterActive?.id, afterActive?.versionNumber);

  const events = await prisma.adjustmentEvent.findMany({
    where: { userId: TEST_USER_ID, triggerType: "ESCALATION_ROLLBACK" },
  });
  console.log("escalation_rollback AdjustmentEvents:", events);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
