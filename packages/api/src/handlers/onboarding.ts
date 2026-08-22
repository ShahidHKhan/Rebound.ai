import { after } from "next/server";

import { runRegimeGenerationJob, screenOnboarding, upsertUserForOnboarding } from "@rebound/agents";

import type { OnboardingJobStatusResponse, OnboardingSubmissionInput, OnboardingSubmitResponse } from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

import { ApiError } from "../errors";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

// Mirrors packages/api/src/routers/onboarding.ts's submit procedure exactly
// — same screening order (crisis before red-flag), same 7-day cooldown
// window, same after()-with-fire-and-forget-fallback job kickoff.
export async function submitOnboarding(ctx: Ctx, input: OnboardingSubmissionInput): Promise<OnboardingSubmitResponse> {
  const screening = await screenOnboarding(input);

  if (screening.crisisFlagged) {
    return { status: "crisis_detected", reasons: screening.crisisReasons };
  }

  if (screening.flagged) {
    return { status: "red_flagged", reasons: screening.reasons };
  }

  // Regime-generation limiter: at most 1 new regime per Flow B cycle
  // (7 days) while one is actively running — mirrors Flow B's own
  // adjustment cadence (apps/web/src/app/api/cron/flow-b/route.ts).
  // Deliberately restarting (regime.restart) ends the active regime first,
  // which clears this immediately — the limiter targets repeated onboarding
  // submissions while a regime is already active and young, not a genuine
  // restart.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentActiveRegime = await ctx.prisma.regime.findFirst({
    where: { userId: ctx.userId, status: "ACTIVE", createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });
  if (recentActiveRegime) {
    return { status: "cooldown_active", regimeCreatedAt: recentActiveRegime.createdAt.toISOString() };
  }

  // Must happen before job creation — RegimeGenerationJob.userId is a
  // required foreign key to User.
  await upsertUserForOnboarding(ctx.userId, input);

  const job = await ctx.prisma.regimeGenerationJob.create({
    data: { userId: ctx.userId, status: "PENDING" },
  });

  try {
    after(() => runRegimeGenerationJob(job.id, ctx.userId, input));
  } catch {
    // after() requires an active Next.js request scope — unavailable when
    // this handler runs outside real HTTP handling (e.g. via withTestCtx in
    // scripts/tests). Fall back to fire-and-forget.
    void runRegimeGenerationJob(job.id, ctx.userId, input);
  }

  return { status: "job_created", jobId: job.id };
}

export async function getOnboardingJobStatus(
  ctx: Ctx,
  input: { jobId: string }
): Promise<OnboardingJobStatusResponse> {
  const job = await ctx.prisma.regimeGenerationJob.findUniqueOrThrow({
    where: { id: input.jobId },
    select: { id: true, userId: true, status: true, resultRegimeId: true, createdAt: true, completedAt: true },
  });

  if (job.userId !== ctx.userId) {
    throw new ApiError("FORBIDDEN");
  }

  // Deliberately excludes `error`/`retryCount`/`fallbackPresetId` — `error`
  // carries raw internal exception text (Prisma/Anthropic SDK messages),
  // never safe to forward to the client that triggered the failure.
  return {
    id: job.id,
    status: job.status,
    resultRegimeId: job.resultRegimeId,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
