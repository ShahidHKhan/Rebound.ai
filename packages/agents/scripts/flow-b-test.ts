import { prisma } from "@rebound/db";

import { runOnboarding } from "../src/onboarding";
import { runFlowBForUser } from "../src/flow-b-runner";
import type { OnboardingSubmission } from "../src/onboarding";

const BASE_SUBMISSION: OnboardingSubmission = {
  answers: {
    age: 30,
    goalType: "MOBILITY",
    conditionFlags: [],
    injurySeverity: "none",
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

// Makes the script safely re-runnable for the same test user id — deletes
// respect FK order since neither AdjustmentEvent nor SessionLog cascades
// from Regime (RegimeExercise does, via onDelete: Cascade).
async function resetTestUser(userId: string) {
  await prisma.adjustmentEvent.deleteMany({ where: { userId } });
  await prisma.sessionLog.deleteMany({ where: { userId } });
  await prisma.regime.deleteMany({ where: { userId } });
}

async function runScenario(userId: string, painTrend: number[]) {
  await resetTestUser(userId);

  const onboarding = await runOnboarding(userId, BASE_SUBMISSION);
  if (onboarding.status !== "regime_drafted") throw new Error("Expected a drafted regime");

  await prisma.regime.update({ where: { id: onboarding.regimeId }, data: { status: "ACTIVE" } });
  await seedTrailingLogs(userId, onboarding.regimeId, painTrend);

  const result = await runFlowBForUser(userId);
  console.log(`Pain trend: ${painTrend.join(" -> ")}`);
  console.log(result);
}

async function main() {
  console.log("=== Scenario A: improving trend ===");
  await runScenario("test-user-flow-b-improving", [6, 6, 5, 5, 4, 3, 2]);

  console.log("\n=== Scenario B: worsening trend ===");
  await runScenario("test-user-flow-b-worsening", [2, 3, 3, 4, 5, 5, 6]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
