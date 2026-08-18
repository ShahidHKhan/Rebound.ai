import { prisma } from "../src";

// Starter fixtures for the admin experimentation dashboard's dry-run test
// runs (packages/agents/src/admin-test-runs.ts) — never referenced by a
// real User row. Fixed ids so this script is idempotent (upsert, not
// insert), same pattern as seed-presets.ts.

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const ONBOARDING_FIXTURES = [
  {
    id: "fixture-onboarding-general",
    name: "Onboarding — General, mobility goal",
    description: "No injury, general-fitness/mobility goal — should land in the GENERAL risk tier.",
    payload: {
      answers: {
        age: 29,
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
      targetMovement: "Overhead squat",
      symptomsText: "No real symptoms, just feel stiff most mornings and want to move better before lifting.",
      lifestyleContextText: "Desk job, lifts 4x/week, mostly wants more mobility work bolted onto an existing routine.",
    },
  },
  {
    id: "fixture-onboarding-light-injury",
    name: "Onboarding — Light injury, ankle sprain",
    description: "Mild recent ankle sprain — should land in the LIGHT_INJURY risk tier.",
    payload: {
      answers: {
        age: 24,
        goalType: "INJURY_RECOVERY",
        conditionFlags: [],
        injurySeverity: "mild",
        redFlags: {
          severeSuddenPain: false,
          numbnessOrTingling: false,
          recentTrauma: false,
          recentSurgery: false,
          pregnancyRelated: false,
          cardiacSymptomsWithExertion: false,
        },
      },
      targetMovement: "Running",
      symptomsText: "Rolled my left ankle playing basketball 10 days ago. Mild swelling gone, still a bit stiff going downstairs.",
      lifestyleContextText: "Competitive rec-league basketball player, wants back to full training before the season restarts.",
    },
  },
  {
    id: "fixture-onboarding-heavier-chronic",
    name: "Onboarding — Heavier/chronic, autoimmune flare",
    description: "Autoimmune condition flag — should land in the HEAVIER_CHRONIC_ELDERLY risk tier.",
    payload: {
      answers: {
        age: 41,
        goalType: "STRENGTH",
        conditionFlags: ["autoimmune"],
        injurySeverity: "moderate",
        redFlags: {
          severeSuddenPain: false,
          numbnessOrTingling: false,
          recentTrauma: false,
          recentSurgery: false,
          pregnancyRelated: false,
          cardiacSymptomsWithExertion: false,
        },
      },
      targetMovement: "Deadlift",
      symptomsText: "Rheumatoid arthritis, currently mid-flare in both wrists and one knee. Want to keep some strength work going without making the flare worse.",
      lifestyleContextText: "Trains 3x/week normally, flares come and go every few months, has learned to scale back during them.",
    },
  },
];

async function main() {
  for (const fixture of ONBOARDING_FIXTURES) {
    await prisma.testFixture.upsert({
      where: { id: fixture.id },
      create: { id: fixture.id, name: fixture.name, description: fixture.description, type: "ONBOARDING", payload: fixture.payload },
      update: { name: fixture.name, description: fixture.description, payload: fixture.payload },
    });
    console.log(`${fixture.id}: seeded`);
  }

  // ADJUSTMENT fixtures need real exercise ids for currentRegime — pull a
  // small conservative pool, same source seed-presets.ts uses.
  const pool = await prisma.exercise.findMany({
    where: { category: { in: ["STRETCH", "MOBILITY"] }, difficultyLevel: 1 },
    orderBy: { name: "asc" },
    take: 4,
  });

  if (pool.length < 4) {
    throw new Error("Fewer than 4 low-difficulty STRETCH/MOBILITY exercises found — run the exercise seed script first.");
  }

  const currentRegime = {
    exercises: [
      { exerciseId: pool[0]!.id, durationSeconds: 20, sessionSlot: "MORNING" as const },
      { exerciseId: pool[1]!.id, durationSeconds: 20, sessionSlot: "MORNING" as const },
      { exerciseId: pool[2]!.id, sets: 2, reps: 10, sessionSlot: "EVENING" as const },
      { exerciseId: pool[3]!.id, sets: 2, reps: 10, sessionSlot: "EVENING" as const },
    ],
  };

  // Most-recent-first, matching how runFlowBForUser builds trailingSessionLogs
  // (packages/agents/src/flow-b-runner.ts).
  const ADJUSTMENT_FIXTURES = [
    {
      id: "fixture-adjustment-plateauing",
      name: "Adjustment — Plateauing",
      description: "Pain flat around 4-5 for a week — PRD's named 'plateauing' trajectory. Expect hold, or a very small progress.",
      riskTier: "LIGHT_INJURY" as const,
      painScores: [5, 4, 5, 4, 5, 4, 5],
      madeItWorseIndex: -1,
    },
    {
      id: "fixture-adjustment-worsening",
      name: "Adjustment — Worsening",
      description: "Pain climbing day over day — PRD's named 'worsening' trajectory. Expect rollback, not progress.",
      riskTier: "LIGHT_INJURY" as const,
      painScores: [8, 7, 6, 5, 4, 3, 2],
      madeItWorseIndex: -1,
    },
    {
      id: "fixture-adjustment-contradictory",
      name: "Adjustment — Contradictory",
      description: "Pain bouncing between green and red with a 'made it worse' flag — PRD's named 'contradictory' trajectory. Tests whether the LLM/validator handle a noisy, non-monotonic signal safely.",
      riskTier: "GENERAL" as const,
      painScores: [8, 3, 7, 2, 8, 3, 6],
      madeItWorseIndex: 0,
    },
  ];

  for (const fixture of ADJUSTMENT_FIXTURES) {
    const trailingSessionLogs = fixture.painScores.map((painScore, index) => ({
      date: daysAgo(index),
      painScore,
      madeItWorseFlag: index === fixture.madeItWorseIndex,
    }));

    const payload = { riskTier: fixture.riskTier, currentRegime, trailingSessionLogs };

    await prisma.testFixture.upsert({
      where: { id: fixture.id },
      create: { id: fixture.id, name: fixture.name, description: fixture.description, type: "ADJUSTMENT", payload },
      update: { name: fixture.name, description: fixture.description, payload },
    });
    console.log(`${fixture.id}: seeded`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
