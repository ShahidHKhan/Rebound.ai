import { prisma } from "@rebound/db";

async function main() {
  const regimes = await prisma.regime.findMany({
    where: { userId: "test-user-day4-reescalate" },
    orderBy: { versionNumber: "asc" },
  });
  console.log(regimes.map((r) => ({ id: r.id, versionNumber: r.versionNumber, status: r.status })));

  const events = await prisma.adjustmentEvent.findMany({
    where: { userId: "test-user-day4-reescalate" },
    orderBy: { triggeredAt: "asc" },
  });
  console.log(events.map((e) => ({ from: e.fromRegimeVersionId, to: e.toRegimeVersionId, triggeredAt: e.triggeredAt })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
