import { prisma } from "@rebound/db";
import { validateRegime, validateStructure } from "@rebound/clinical-rules";

import { generateInitialRegime } from "../src/flow-a";

const TEST_USER_ID = "test-user-flow-a";

async function main() {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      goalType: "MOBILITY",
      riskTier: "GENERAL",
      conditionFlags: [],
      targetMovements: ["touching toes without knee bend"],
    },
    update: {},
  });

  const draft = await generateInitialRegime({
    goalType: "MOBILITY",
    targetMovement: "touching toes without knee bend",
    riskTier: "GENERAL",
    symptomsText: "Mild stiffness in lower back and hamstrings, no sharp pain.",
    lifestyleContextText: "Busy office worker, sits most of the day, ~20 minutes free per session.",
  });

  const structural = validateStructure(draft);
  if (!structural.success) {
    throw new Error(`Structural validation failed: ${JSON.stringify(structural.error.issues)}`);
  }

  const clinical = validateRegime(draft, "GENERAL");
  if (!clinical.valid) {
    throw new Error(`Clinical validation failed: ${JSON.stringify(clinical.issues)}`);
  }

  const regime = await prisma.regime.create({
    data: {
      userId: TEST_USER_ID,
      versionNumber: 1,
      createdBy: "AGENT",
      status: "DRAFT",
      exerciseList: {
        create: draft.exercises.map((exercise, index) => ({
          exerciseId: exercise.exerciseId,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSeconds: exercise.durationSeconds,
          frequency: exercise.frequency,
          sessionSlot: exercise.sessionSlot,
          orderIndex: index,
        })),
      },
    },
    include: { exerciseList: true },
  });

  console.log(
    `Persisted regime ${regime.id} (status: ${regime.status}) with ${regime.exerciseList.length} exercises.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
