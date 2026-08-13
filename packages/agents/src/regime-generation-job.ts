import { prisma } from "@rebound/db";

import { draftAndPersistRegime } from "./onboarding";
import type { OnboardingSubmission } from "./onboarding";
import { assignFallbackPreset } from "./preset-fallback";

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Backs Flow A's async-job architecture (System Design > v1 Beta): retries
// with backoff, updates RegimeGenerationJob as it goes. Once attempts are
// exhausted, falls back to the closest-matching Preset (LLM Reliability &
// Failure Handling) so onboarding still completes same-day — status stays
// FAILED (keeps this in the admin panel's flagged-users queue) but
// resultRegimeId points at the preset-derived regime, exactly like the
// System Design sequence diagram's "status: failed + preset ... + regime
// draft" branch.
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
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

        try {
          const { regimeId, presetId } = await assignFallbackPreset(userId, user.riskTier);
          await prisma.regimeGenerationJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              retryCount: attempt,
              error: message,
              resultRegimeId: regimeId,
              fallbackPresetId: presetId,
            },
          });
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          await prisma.regimeGenerationJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              retryCount: attempt,
              error: `${message} | preset fallback also failed: ${fallbackMessage}`,
            },
          });
        }
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
