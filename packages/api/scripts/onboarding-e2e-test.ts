import { prisma } from "@rebound/db";

import { appRouter } from "../src/root";
import { createInnerContext } from "../src/context";

const TEST_USER_ID = "test-user-trpc-e2e";

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

async function main() {
  await prisma.workoutSession.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.regimeGenerationJob.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.adjustmentEvent.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.sessionLog.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.regime.deleteMany({ where: { userId: TEST_USER_ID } });

  const caller = appRouter.createCaller(createInnerContext({ userId: TEST_USER_ID }));

  const submitResult = await caller.onboarding.submit(SUBMISSION);
  console.log("submit ->", submitResult);

  if (submitResult.status !== "job_created") {
    throw new Error("Expected a job to be created");
  }

  let job = await caller.onboarding.getJobStatus({ jobId: submitResult.jobId });
  while (job.status === "PENDING") {
    console.log("polling... status:", job.status, "retryCount:", job.retryCount);
    await sleep(1500);
    job = await caller.onboarding.getJobStatus({ jobId: submitResult.jobId });
  }

  console.log("final job:", job);

  if (job.status !== "COMPLETE" || !job.resultRegimeId) {
    throw new Error(`Job did not complete successfully: ${JSON.stringify(job)}`);
  }

  const activateResult = await caller.regime.activate({ regimeId: job.resultRegimeId });
  console.log("activate ->", activateResult);

  const workoutSessions = await prisma.workoutSession.findMany({
    where: { userId: TEST_USER_ID },
    orderBy: { slot: "asc" },
  });
  console.log(`workout sessions created: ${workoutSessions.length}`);
  console.log(workoutSessions.map((ws) => ({ slot: ws.slot, date: ws.date, scheduledAt: ws.scheduledAt })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
