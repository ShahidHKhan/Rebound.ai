import { prisma } from "@rebound/db";
import { validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { DraftRegime, RiskTier } from "@rebound/clinical-rules";

export interface FallbackResult {
  regimeId: string;
  presetId: string;
}

// LLM Reliability & Failure Handling: called when Flow A exhausts its
// retries. Clones the closest-matching Preset into a personal DRAFT Regime
// for the user, so they review/activate it exactly like a genuine LLM
// draft — same flow, just a different (pre-vetted, conservative) source.
export async function assignFallbackPreset(userId: string, riskTier: RiskTier): Promise<FallbackResult> {
  const preset =
    (await prisma.preset.findFirst({ where: { riskTier }, include: { exerciseList: true } })) ??
    (await prisma.preset.findFirst({ where: { riskTier: null }, include: { exerciseList: true } })) ??
    (await prisma.preset.findFirst({ include: { exerciseList: true } }));

  if (!preset) {
    throw new Error("No presets available for fallback — seed presets first (packages/db seed:presets).");
  }

  const draft: DraftRegime = {
    exercises: preset.exerciseList.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets ?? undefined,
      reps: e.reps ?? undefined,
      durationSeconds: e.durationSeconds ?? undefined,
      frequency: e.frequency ?? undefined,
      sessionSlot: e.sessionSlot,
    })),
  };

  // Presets are meant to be pre-vetted, but validate anyway — catches a bad
  // seed rather than silently persisting an invalid regime.
  const structural = validateStructure(draft);
  if (!structural.success) {
    throw new Error(`Preset ${preset.id} failed structural validation: ${JSON.stringify(structural.error.issues)}`);
  }
  const clinical = validateRegime(draft, riskTier);
  if (!clinical.valid) {
    throw new Error(
      `Preset ${preset.id} failed clinical validation: ${clinical.issues.map((i) => i.message).join("; ")}`
    );
  }

  const lastRegime = await prisma.regime.findFirst({
    where: { userId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (lastRegime?.versionNumber ?? 0) + 1;

  const regime = await prisma.regime.create({
    data: {
      userId,
      versionNumber,
      createdBy: "PRESET_FALLBACK",
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
  });

  return { regimeId: regime.id, presetId: preset.id };
}
