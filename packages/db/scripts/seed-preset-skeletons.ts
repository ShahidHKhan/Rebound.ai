import { prisma } from "../src";
import type { ExerciseCategory, GoalType, RiskTier, SessionSlot } from "../src";

// Content Sourcing & Trustworthiness: each skeleton's slots trace back to a
// named, checkable source (see each rationale) rather than being drafted
// from unstructured model knowledge — see HANDOFF.md's Flow A/B research
// session for the sourcing discussion this came out of.
//
// Fixed ids (not the cuid default) so this script is idempotent, same
// pattern as seed-presets.ts.
interface SlotSpec {
  sessionSlot: SessionSlot;
  orderIndex: number;
  label: string;
  exerciseCategory?: ExerciseCategory;
  muscleGroupTags: string[];
  maxDifficulty?: number;
  suggestedSets?: number;
  suggestedReps?: number;
  suggestedDurationSeconds?: number;
  suggestedFrequency?: string;
  rationale: string;
}

interface SkeletonSpec {
  id: string;
  name: string;
  description: string;
  goalType: GoalType;
  riskTier: RiskTier;
  bodyRegionTags: string[];
  slots: SlotSpec[];
}

const LBP_CITATION =
  "APTA/Academy of Orthopaedic Physical Therapy Low Back Pain CPG, JOSPT 2021;51(11) (jospt.org/doi/10.2519/jospt.2021.0304) — recommends trunk strengthening/endurance and movement-control or trunk mobility exercise for chronic LBP; covers both the ICF 'mobility deficit' and 'movement coordination impairment' subgroups since onboarding doesn't finely subclassify presentation.";

const SHOULDER_CITATION =
  "JOSPT 2024 'FITT Odyssey' scoping review of exercise programs for rotator-cuff-related shoulder pain (jospt.org/doi/10.2519/jospt.2024.12452) — reviewed trials used 2-7x/week, 1-3 sets, 4-30 reps/set; this skeleton uses the conservative low end for the LIGHT_INJURY tier. The review's own conclusion: no single validated FITT formula exists.";

const MOBILITY_CITATION =
  "ACSM Flexibility Training Guidelines — stretch major muscle-tendon groups >=2-3x/week (daily preferable), hold 10-30s, 2-4 reps per stretch.";

const STRENGTH_CITATION =
  "ACSM 2026 Resistance Training Guidelines update — for a strength-specific goal, heavier loads (~80% 1RM) for 2-3 sets/exercise. This data model has no load/%1RM field, so 'heavier load' is approximated here as a lower rep range (6-10) at a higher difficulty ceiling — an inference, not a number the guideline itself states.";

const GENERAL_FITNESS_CITATION =
  "ACSM Resistance Training Guidelines / Position Stand (2026 update) — minimum 2 sets/exercise, 8-20 reps, >=2x/week for healthy adults; general FITT-VP framework notes complex periodization isn't necessary for general-population health outcomes.";

const WARMUP_RATIONALE = "General warm-up practice preceding resistance work — convention, not itself drawn from a specific dosing citation.";
const COOLDOWN_RATIONALE = "Standard cooldown/flexibility practice — general convention, not a specific dosing citation.";

const SKELETON_SPECS: SkeletonSpec[] = [
  {
    id: "skeleton-lbp-light-injury",
    name: "Low back pain — mobility & motor control starter",
    description: "Conservative low-back skeleton covering both mobility-deficit and movement-coordination-impairment presentations.",
    goalType: "INJURY_RECOVERY",
    riskTier: "LIGHT_INJURY",
    bodyRegionTags: ["lower_back", "back", "spine", "lumbar"],
    slots: [
      { sessionSlot: "MORNING", orderIndex: 0, label: "Lumbar/hip mobility drill", exerciseCategory: "MOBILITY", muscleGroupTags: ["lower back", "hips"], maxDifficulty: 1, suggestedDurationSeconds: 30, suggestedFrequency: "daily", rationale: LBP_CITATION },
      { sessionSlot: "MORNING", orderIndex: 1, label: "Trunk motor control / stabilization", exerciseCategory: "STRENGTH", muscleGroupTags: ["core", "lower back"], maxDifficulty: 1, suggestedSets: 2, suggestedReps: 10, suggestedFrequency: "daily", rationale: LBP_CITATION },
      { sessionSlot: "EVENING", orderIndex: 0, label: "Gentle spinal/hip flexibility", exerciseCategory: "STRETCH", muscleGroupTags: ["lower back", "hamstrings", "hips"], maxDifficulty: 1, suggestedDurationSeconds: 20, suggestedFrequency: "daily", rationale: LBP_CITATION },
      { sessionSlot: "EVENING", orderIndex: 1, label: "Secondary trunk strengthening", exerciseCategory: "STRENGTH", muscleGroupTags: ["core", "glutes"], maxDifficulty: 1, suggestedSets: 2, suggestedReps: 8, rationale: LBP_CITATION },
    ],
  },
  {
    id: "skeleton-shoulder-light-injury",
    name: "Shoulder pain — rotator cuff & scapular starter",
    description: "Conservative shoulder skeleton for rotator-cuff-related shoulder pain.",
    goalType: "INJURY_RECOVERY",
    riskTier: "LIGHT_INJURY",
    bodyRegionTags: ["shoulder", "rotator_cuff", "upper_arm"],
    slots: [
      { sessionSlot: "MORNING", orderIndex: 0, label: "Scapular/shoulder mobility drill", exerciseCategory: "MOBILITY", muscleGroupTags: ["shoulders", "upper back"], maxDifficulty: 1, suggestedDurationSeconds: 30, suggestedFrequency: "daily", rationale: SHOULDER_CITATION },
      { sessionSlot: "MORNING", orderIndex: 1, label: "Rotator cuff isometric/light strengthening", exerciseCategory: "STRENGTH", muscleGroupTags: ["shoulders", "rotator cuff"], maxDifficulty: 1, suggestedSets: 2, suggestedReps: 10, suggestedFrequency: "3-4x/week", rationale: SHOULDER_CITATION },
      { sessionSlot: "EVENING", orderIndex: 0, label: "Shoulder/chest flexibility", exerciseCategory: "STRETCH", muscleGroupTags: ["shoulders", "chest"], maxDifficulty: 1, suggestedDurationSeconds: 20, rationale: SHOULDER_CITATION },
      { sessionSlot: "EVENING", orderIndex: 1, label: "Scapular stabilization strengthening", exerciseCategory: "STRENGTH", muscleGroupTags: ["upper back", "shoulders"], maxDifficulty: 1, suggestedSets: 2, suggestedReps: 10, suggestedFrequency: "3-4x/week", rationale: SHOULDER_CITATION },
    ],
  },
  {
    id: "skeleton-mobility-general",
    name: "Mobility starter",
    description: "General mobility/flexibility skeleton for a stated mobility goal, not tied to a specific injury.",
    goalType: "MOBILITY",
    riskTier: "GENERAL",
    bodyRegionTags: ["general"],
    slots: [
      { sessionSlot: "MORNING", orderIndex: 0, label: "Dynamic joint mobility drill", exerciseCategory: "MOBILITY", muscleGroupTags: [], maxDifficulty: 2, suggestedDurationSeconds: 30, suggestedFrequency: "daily", rationale: MOBILITY_CITATION },
      { sessionSlot: "MORNING", orderIndex: 1, label: "Static stretch, major group A", exerciseCategory: "STRETCH", muscleGroupTags: [], maxDifficulty: 1, suggestedReps: 3, suggestedDurationSeconds: 20, suggestedFrequency: "2-3x/week minimum", rationale: MOBILITY_CITATION },
      { sessionSlot: "EVENING", orderIndex: 0, label: "Dynamic joint mobility drill, second region", exerciseCategory: "MOBILITY", muscleGroupTags: [], maxDifficulty: 2, suggestedDurationSeconds: 30, suggestedFrequency: "daily", rationale: MOBILITY_CITATION },
      { sessionSlot: "EVENING", orderIndex: 1, label: "Static stretch, major group B", exerciseCategory: "STRETCH", muscleGroupTags: [], maxDifficulty: 1, suggestedReps: 3, suggestedDurationSeconds: 20, suggestedFrequency: "2-3x/week minimum", rationale: MOBILITY_CITATION },
    ],
  },
  {
    id: "skeleton-strength-general",
    name: "Strength starter",
    description: "General strength-building skeleton for a stated strength goal, no injury presentation.",
    goalType: "STRENGTH",
    riskTier: "GENERAL",
    bodyRegionTags: ["general"],
    slots: [
      { sessionSlot: "MORNING", orderIndex: 0, label: "Mobility warm-up", exerciseCategory: "MOBILITY", muscleGroupTags: [], maxDifficulty: 2, suggestedDurationSeconds: 30, rationale: WARMUP_RATIONALE },
      { sessionSlot: "MORNING", orderIndex: 1, label: "Primary strength, compound", exerciseCategory: "STRENGTH", muscleGroupTags: [], maxDifficulty: 3, suggestedSets: 3, suggestedReps: 8, suggestedFrequency: "2-3x/week", rationale: STRENGTH_CITATION },
      { sessionSlot: "EVENING", orderIndex: 0, label: "Secondary strength, compound", exerciseCategory: "STRENGTH", muscleGroupTags: [], maxDifficulty: 3, suggestedSets: 3, suggestedReps: 8, suggestedFrequency: "2-3x/week", rationale: STRENGTH_CITATION },
      { sessionSlot: "EVENING", orderIndex: 1, label: "Cooldown flexibility", exerciseCategory: "STRETCH", muscleGroupTags: [], maxDifficulty: 1, suggestedDurationSeconds: 20, rationale: COOLDOWN_RATIONALE },
    ],
  },
  {
    id: "skeleton-general-fitness",
    name: "General fitness starter",
    description: "General conditioning skeleton for a general-fitness goal, no injury presentation.",
    goalType: "GENERAL_FITNESS",
    riskTier: "GENERAL",
    bodyRegionTags: ["general"],
    slots: [
      { sessionSlot: "MORNING", orderIndex: 0, label: "Dynamic mobility warm-up", exerciseCategory: "MOBILITY", muscleGroupTags: [], maxDifficulty: 2, suggestedDurationSeconds: 30, rationale: WARMUP_RATIONALE },
      { sessionSlot: "MORNING", orderIndex: 1, label: "General strength, primary", exerciseCategory: "STRENGTH", muscleGroupTags: [], maxDifficulty: 2, suggestedSets: 2, suggestedReps: 12, suggestedFrequency: "2-3x/week", rationale: GENERAL_FITNESS_CITATION },
      { sessionSlot: "EVENING", orderIndex: 0, label: "General strength, secondary", exerciseCategory: "STRENGTH", muscleGroupTags: [], maxDifficulty: 2, suggestedSets: 2, suggestedReps: 12, suggestedFrequency: "2-3x/week", rationale: GENERAL_FITNESS_CITATION },
      { sessionSlot: "EVENING", orderIndex: 1, label: "Cooldown flexibility", exerciseCategory: "STRETCH", muscleGroupTags: [], maxDifficulty: 1, suggestedDurationSeconds: 20, rationale: COOLDOWN_RATIONALE },
    ],
  },
];

async function main() {
  for (const spec of SKELETON_SPECS) {
    const preset = await prisma.preset.upsert({
      where: { id: spec.id },
      create: {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        kind: "SKELETON",
        goalType: spec.goalType,
        riskTier: spec.riskTier,
        bodyRegionTags: spec.bodyRegionTags,
      },
      update: {
        name: spec.name,
        description: spec.description,
        kind: "SKELETON",
        goalType: spec.goalType,
        riskTier: spec.riskTier,
        bodyRegionTags: spec.bodyRegionTags,
      },
    });

    await prisma.presetSlot.deleteMany({ where: { presetId: preset.id } });

    await prisma.presetSlot.createMany({
      data: spec.slots.map((slot) => ({
        presetId: preset.id,
        sessionSlot: slot.sessionSlot,
        orderIndex: slot.orderIndex,
        label: slot.label,
        exerciseCategory: slot.exerciseCategory,
        muscleGroupTags: slot.muscleGroupTags,
        maxDifficulty: slot.maxDifficulty,
        suggestedSets: slot.suggestedSets,
        suggestedReps: slot.suggestedReps,
        suggestedDurationSeconds: slot.suggestedDurationSeconds,
        suggestedFrequency: slot.suggestedFrequency,
        rationale: slot.rationale,
      })),
    });

    console.log(`${spec.id}: ${spec.slots.length} slots (${spec.goalType} / ${spec.riskTier})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
