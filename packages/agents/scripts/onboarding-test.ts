import { prisma } from "@rebound/db";

import { runOnboarding } from "../src/onboarding";
import type { OnboardingSubmission } from "../src/onboarding";

const CLEAR_SUBMISSION: OnboardingSubmission = {
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

const RED_FLAGGED_SUBMISSION: OnboardingSubmission = {
  ...CLEAR_SUBMISSION,
  symptomsText: "36 weeks pregnant, sciatica's been brutal.",
};

// Makes the script safely re-runnable — deletes respect FK order since
// neither AdjustmentEvent nor SessionLog cascades from Regime.
async function resetTestUser(userId: string) {
  await prisma.adjustmentEvent.deleteMany({ where: { userId } });
  await prisma.sessionLog.deleteMany({ where: { userId } });
  await prisma.regime.deleteMany({ where: { userId } });
}

async function main() {
  await resetTestUser("test-user-onboarding-clear");
  await resetTestUser("test-user-onboarding-flagged");

  console.log("=== Scenario A: clear onboarding ===");
  console.log(await runOnboarding("test-user-onboarding-clear", CLEAR_SUBMISSION));

  console.log("\n=== Scenario B: red-flagged via free text ===");
  console.log(await runOnboarding("test-user-onboarding-flagged", RED_FLAGGED_SUBMISSION));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
