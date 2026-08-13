import { prisma } from "@rebound/db";

async function resetUser(userId: string) {
  await prisma.adjustmentEvent.deleteMany({ where: { userId } });
  await prisma.sessionLog.deleteMany({ where: { userId } });
  await prisma.regime.deleteMany({ where: { userId } });
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      goalType: "MOBILITY",
      riskTier: "GENERAL",
      conditionFlags: [],
      targetMovements: ["touching toes without knee bend"],
    },
    update: {},
  });
}

async function buildRolledBackScenario(userId: string, postRollbackPainScores: number[] | null) {
  await resetUser(userId);
  const exercise = await prisma.exercise.findFirstOrThrow();

  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  const v1 = await prisma.regime.create({
    data: {
      userId,
      versionNumber: 1,
      createdBy: "AGENT",
      status: "ACTIVE",
      createdAt: new Date(fourDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
      exerciseList: {
        create: [{ exerciseId: exercise.id, sets: 2, reps: 10, sessionSlot: "MORNING", orderIndex: 0 }],
      },
    },
  });

  const v2 = await prisma.regime.create({
    data: {
      userId,
      versionNumber: 2,
      createdBy: "AGENT",
      status: "SUPERSEDED",
      parentRegimeId: v1.id,
      createdAt: new Date(fourDaysAgo.getTime() - 2 * 24 * 60 * 60 * 1000),
      exerciseList: {
        create: [{ exerciseId: exercise.id, sets: 3, reps: 12, sessionSlot: "MORNING", orderIndex: 0 }],
      },
    },
  });

  // Re-activate v1 — this is the rollback target.
  await prisma.regime.update({ where: { id: v1.id }, data: { status: "ACTIVE" } });

  // The log that actually triggered the rollback: baseline pain = 7.
  await prisma.sessionLog.create({
    data: { userId, regimeVersionId: v2.id, loggedAt: fourDaysAgo, painScore: 7, completed: true, flag: false },
  });

  await prisma.adjustmentEvent.create({
    data: {
      userId,
      fromRegimeVersionId: v2.id,
      toRegimeVersionId: v1.id,
      triggerType: "ESCALATION_ROLLBACK",
      trailingWindowUsed: 1,
      triggeredAt: fourDaysAgo,
      rationale: "single log, pain red (7-10)",
    },
  });

  if (postRollbackPainScores) {
    for (const [i, painScore] of postRollbackPainScores.entries()) {
      const daysAfter = i + 1;
      const loggedAt = new Date(fourDaysAgo.getTime() + daysAfter * 24 * 60 * 60 * 1000);
      await prisma.sessionLog.create({
        data: { userId, regimeVersionId: v1.id, loggedAt, painScore, completed: true, flag: false },
      });
    }
  }

  console.log(`${userId}: v1=${v1.id} v2=${v2.id} rollback baseline pain=7`);
}

async function main() {
  // Scenario A: pain stayed at/below baseline (7) every day since -> should resume normally.
  await buildRolledBackScenario("test-user-day4-resumed", [3, 3, 2]);

  // Scenario B: pain exceeded baseline again recently -> should re-escalate.
  await buildRolledBackScenario("test-user-day4-reescalate", [3, 3, 8]);

  // Scenario C: no logs at all since the rollback -> inconclusive, no action.
  await buildRolledBackScenario("test-user-day4-inconclusive", null);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
