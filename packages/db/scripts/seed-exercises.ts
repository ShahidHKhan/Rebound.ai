import { prisma } from "../src";

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

// Free Exercise DB ships 7 categories; our schema only models 3 slot-relevant
// buckets. Cardio/plyometrics lean dynamic-movement rather than loaded
// strength work, so they map to "mobility" over "strength" by default.
const CATEGORY_MAP: Record<string, "MOBILITY" | "STRENGTH" | "STRETCH"> = {
  stretching: "STRETCH",
  strength: "STRENGTH",
  powerlifting: "STRENGTH",
  strongman: "STRENGTH",
  "olympic weightlifting": "STRENGTH",
  cardio: "MOBILITY",
  plyometrics: "MOBILITY",
};

const LEVEL_MAP: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  expert: 3,
};

interface FreeExerciseDbEntry {
  id: string;
  name: string;
  category: string;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

async function main() {
  console.log(`Fetching exercise data from ${SOURCE_URL}...`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch exercise data: ${response.status} ${response.statusText}`);
  }
  const entries = (await response.json()) as FreeExerciseDbEntry[];
  console.log(`Fetched ${entries.length} exercises. Upserting...`);

  let upserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    const category = CATEGORY_MAP[entry.category];
    if (!category) {
      skipped++;
      continue;
    }

    await prisma.exercise.upsert({
      where: { externalId: entry.id },
      create: {
        externalId: entry.id,
        name: entry.name,
        category,
        targetMuscleGroups: [...entry.primaryMuscles, ...entry.secondaryMuscles],
        difficultyLevel: LEVEL_MAP[entry.level] ?? 1,
        contraindications: [],
        source: "Free Exercise DB",
        media: { instructions: entry.instructions, images: entry.images },
      },
      update: {
        name: entry.name,
        category,
        targetMuscleGroups: [...entry.primaryMuscles, ...entry.secondaryMuscles],
        difficultyLevel: LEVEL_MAP[entry.level] ?? 1,
        media: { instructions: entry.instructions, images: entry.images },
      },
    });
    upserted++;
  }

  console.log(`Done. Upserted ${upserted}, skipped ${skipped} (unmapped category).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
