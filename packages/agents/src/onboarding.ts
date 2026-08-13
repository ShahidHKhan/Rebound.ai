import { prisma } from "@rebound/db";
import { checkRedFlags, determineRiskTier, validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { OnboardingAnswers } from "@rebound/clinical-rules";

import { classifyFreeTextRedFlags } from "./free-text-red-flag-classifier";
import { generateInitialRegime } from "./flow-a";

export interface OnboardingSubmission {
  answers: OnboardingAnswers;
  targetMovement: string;
  symptomsText: string;
  lifestyleContextText: string;
}

export type OnboardingResult =
  | { status: "red_flagged"; reasons: string[] }
  | { status: "regime_drafted"; regimeId: string; exerciseCount: number };

export async function runOnboarding(
  userId: string,
  submission: OnboardingSubmission
): Promise<OnboardingResult> {
  // Gate 1: structured red-flag screen (rules-based, no LLM).
  const structuredScreen = checkRedFlags(submission.answers);

  // Gate 2: free-text classifier — catches disclosures the structured screen missed.
  const freeText = `${submission.symptomsText}\n\n${submission.lifestyleContextText}`.trim();
  const freeTextScreen = freeText
    ? await classifyFreeTextRedFlags(freeText)
    : { flagged: false, reasons: [] };

  const reasons = [...structuredScreen.reasons, ...freeTextScreen.reasons];
  if (structuredScreen.flagged || freeTextScreen.flagged) {
    return { status: "red_flagged", reasons };
  }

  // Both gates clear — proceed to risk tiering and Flow A.
  const riskTier = determineRiskTier(submission.answers);

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      goalType: submission.answers.goalType,
      riskTier,
      conditionFlags: submission.answers.conditionFlags,
      targetMovements: [submission.targetMovement],
    },
    update: { riskTier },
  });

  const draft = await generateInitialRegime({
    goalType: submission.answers.goalType,
    targetMovement: submission.targetMovement,
    riskTier,
    symptomsText: submission.symptomsText,
    lifestyleContextText: submission.lifestyleContextText,
  });

  const structural = validateStructure(draft);
  if (!structural.success) {
    throw new Error(`Structural validation failed: ${JSON.stringify(structural.error.issues)}`);
  }

  const clinical = validateRegime(draft, riskTier);
  if (!clinical.valid) {
    throw new Error(`Clinical validation failed: ${JSON.stringify(clinical.issues)}`);
  }

  const regime = await prisma.regime.create({
    data: {
      userId,
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

  return { status: "regime_drafted", regimeId: regime.id, exerciseCount: regime.exerciseList.length };
}
