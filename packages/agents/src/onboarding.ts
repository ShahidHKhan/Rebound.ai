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
  // Daily Session Structure: morning "on wake", evening "at sunset" — both
  // optional, regime.activate falls back to placeholder times when absent.
  wakeTimeMinutes?: number;
  latitude?: number;
  longitude?: number;
}

export interface ScreeningResult {
  flagged: boolean;
  reasons: string[];
}

export type OnboardingResult =
  | { status: "red_flagged"; reasons: string[] }
  | { status: "regime_drafted"; regimeId: string; exerciseCount: number };

// The synchronous part of Flow A: both red-flag gates, fast enough to run
// inline before the client gets a response (System Design > Flow A sequence).
export async function screenOnboarding(submission: OnboardingSubmission): Promise<ScreeningResult> {
  const structuredScreen = checkRedFlags(submission.answers);

  const freeText = `${submission.symptomsText}\n\n${submission.lifestyleContextText}`.trim();
  const freeTextScreen = freeText
    ? await classifyFreeTextRedFlags(freeText)
    : { flagged: false, reasons: [] };

  return {
    flagged: structuredScreen.flagged || freeTextScreen.flagged,
    reasons: [...structuredScreen.reasons, ...freeTextScreen.reasons],
  };
}

// Must run before RegimeGenerationJob is created — the job row has a
// required foreign key to User, so the user has to exist first. Kept
// separate from draftAndPersistRegime so the real tRPC procedure can call
// it synchronously, before spawning the background job.
export async function upsertUserForOnboarding(userId: string, submission: OnboardingSubmission): Promise<void> {
  const riskTier = determineRiskTier(submission.answers);

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      goalType: submission.answers.goalType,
      riskTier,
      conditionFlags: submission.answers.conditionFlags,
      targetMovements: [submission.targetMovement],
      wakeTimeMinutes: submission.wakeTimeMinutes,
      latitude: submission.latitude,
      longitude: submission.longitude,
    },
    // undefined fields are omitted by Prisma, not nulled — a re-submission
    // that skips these (e.g. declined location permission) leaves any
    // previously-set values alone rather than wiping them.
    update: {
      riskTier,
      wakeTimeMinutes: submission.wakeTimeMinutes,
      latitude: submission.latitude,
      longitude: submission.longitude,
    },
  });
}

// The slow part: risk tiering + the LLM tool-use draft + validation +
// persistence. This is what runs inside the background job. Assumes the
// User row already exists (see upsertUserForOnboarding above).
export async function draftAndPersistRegime(
  userId: string,
  submission: OnboardingSubmission
): Promise<{ regimeId: string; exerciseCount: number }> {
  const riskTier = determineRiskTier(submission.answers);

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

  // Not just a first-onboarding path in practice — the same user can hit
  // this again (retry, resubmission), so the next version number has to be
  // computed rather than assumed, same as flow-b-runner.ts does for Flow B.
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

  return { regimeId: regime.id, exerciseCount: regime.exerciseList.length };
}

// Convenience wrapper combining both steps synchronously — used by test
// scripts. The real onboarding.submit tRPC procedure (Task 11) calls the
// two halves separately so only screening blocks the client response.
export async function runOnboarding(
  userId: string,
  submission: OnboardingSubmission
): Promise<OnboardingResult> {
  const screening = await screenOnboarding(submission);
  if (screening.flagged) {
    return { status: "red_flagged", reasons: screening.reasons };
  }

  await upsertUserForOnboarding(userId, submission);
  const { regimeId, exerciseCount } = await draftAndPersistRegime(userId, submission);
  return { status: "regime_drafted", regimeId, exerciseCount };
}
