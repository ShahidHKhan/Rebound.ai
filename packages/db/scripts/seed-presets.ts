import { prisma } from "../src";
import type { RiskTier } from "../src";

// LLM Reliability & Failure Handling: fallback destination when Flow A
// exhausts its retries — "hand the user the closest-matching general preset
// for their risk tier." Conservative/low-intensity by design, same
// provisional-defaults caveat as ABSOLUTE_BOUNDS in clinical-rules (no
// PT-annotated content in v1 — see Technical Scope > Deferred).
//
// Fixed ids (not the cuid default) so this script is idempotent — re-running
// it upserts in place rather than colliding with FK references from any
// RegimeGenerationJob that has already used a preset as a fallback.
interface PresetSpec {
  id: string;
  name: string;
  description: string;
  riskTier: RiskTier;
  morningCount: number;
  eveningCount: number;
}

const PRESET_SPECS: PresetSpec[] = [
  {
    id: "preset-general",
    name: "General starter",
    description: "Conservative default for the General risk tier — used when Flow A can't draft a personalized regime.",
    riskTier: "GENERAL",
    morningCount: 3,
    eveningCount: 3,
  },
  {
    id: "preset-light-injury",
    name: "Light injury starter",
    description: "Conservative default for the Light Injury risk tier.",
    riskTier: "LIGHT_INJURY",
    morningCount: 3,
    eveningCount: 2,
  },
  {
    id: "preset-heavier-chronic-elderly",
    name: "Heavier/chronic/elderly starter",
    description: "Most conservative default — Heavier/chronic/elderly risk tier defaults to hold-only, so this preset stays minimal.",
    riskTier: "HEAVIER_CHRONIC_ELDERLY",
    morningCount: 2,
    eveningCount: 2,
  },
];

async function main() {
  // Conservative content pool: gentle categories, lowest difficulty level,
  // ordered by name for a deterministic (idempotent) selection.
  const pool = await prisma.exercise.findMany({
    where: { category: { in: ["STRETCH", "MOBILITY"] }, difficultyLevel: 1 },
    orderBy: { name: "asc" },
    take: 40,
  });

  if (pool.length === 0) {
    throw new Error("No low-difficulty STRETCH/MOBILITY exercises found — run the exercise seed script first.");
  }

  let poolIndex = 0;
  function nextExercise() {
    // Non-null: pool.length > 0 is checked above before this is ever called.
    const exercise = pool[poolIndex % pool.length]!;
    poolIndex++;
    return exercise;
  }

  for (const spec of PRESET_SPECS) {
    const preset = await prisma.preset.upsert({
      where: { id: spec.id },
      create: { id: spec.id, name: spec.name, description: spec.description, riskTier: spec.riskTier },
      update: { name: spec.name, description: spec.description, riskTier: spec.riskTier },
    });

    await prisma.presetExercise.deleteMany({ where: { presetId: preset.id } });

    const morning = Array.from({ length: spec.morningCount }, () => nextExercise());
    const evening = Array.from({ length: spec.eveningCount }, () => nextExercise());

    function toPresetExercise(exercise: (typeof pool)[number], index: number, sessionSlot: "MORNING" | "EVENING") {
      const isStretch = exercise.category === "STRETCH";
      return {
        presetId: preset.id,
        exerciseId: exercise.id,
        sets: isStretch ? undefined : 2,
        reps: isStretch ? undefined : 10,
        durationSeconds: isStretch ? 20 : undefined,
        sessionSlot,
        orderIndex: index,
      };
    }

    await prisma.presetExercise.createMany({
      data: [
        ...morning.map((exercise, index) => toPresetExercise(exercise, index, "MORNING")),
        ...evening.map((exercise, index) => toPresetExercise(exercise, index, "EVENING")),
      ],
    });

    console.log(`${spec.id}: ${morning.length + evening.length} exercises (${spec.riskTier})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
