import { prisma } from "@rebound/db";

const USER_ID = "test-user-cron-due";

async function main() {
  await prisma.adjustmentEvent.deleteMany({ where: { userId: USER_ID } });
  await prisma.sessionLog.deleteMany({ where: { userId: USER_ID } });
  await prisma.regime.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      goalType: "MOBILITY",
      riskTier: "GENERAL",
      conditionFlags: [],
      targetMovements: ["touching toes without knee bend"],
    },
    update: {},
  });

  const eightDaysAgo = new Date();
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

  const exercise = await prisma.exercise.findFirstOrThrow();

  const regime = await prisma.regime.create({
    data: {
      userId: USER_ID,
      versionNumber: 1,
      createdBy: "AGENT",
      status: "ACTIVE",
      createdAt: eightDaysAgo,
      exerciseList: {
        create: [{ exerciseId: exercise.id, sets: 2, reps: 10, sessionSlot: "MORNING", orderIndex: 0 }],
      },
    },
  });

  console.log("Backdated ACTIVE regime created:", regime.id, "createdAt:", regime.createdAt);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
