import { prisma } from "@rebound/db";

import { draftAndPersistRegime } from "./onboarding";
import type { OnboardingSubmission } from "./onboarding";

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Backs Flow A's async-job architecture (System Design > v1 Beta): retries
// with backoff, updates RegimeGenerationJob as it goes, marks failed
// (flagged for admin review) once attempts are exhausted. Preset fallback
// is deferred — no Preset data has been seeded yet.
export async function runRegimeGenerationJob(
  jobId: string,
  userId: string,
  submission: OnboardingSubmission
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { regimeId } = await draftAndPersistRegime(userId, submission);
      await prisma.regimeGenerationJob.update({
        where: { id: jobId },
        data: { status: "COMPLETE", completedAt: new Date(), resultRegimeId: regimeId, retryCount: attempt - 1 },
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (attempt === MAX_ATTEMPTS) {
        await prisma.regimeGenerationJob.update({
          where: { id: jobId },
          data: { status: "FAILED", retryCount: attempt, error: message },
        });
        return;
      }

      await prisma.regimeGenerationJob.update({
        where: { id: jobId },
        data: { retryCount: attempt, error: message },
      });
      await sleep(500 * attempt);
    }
  }
}
