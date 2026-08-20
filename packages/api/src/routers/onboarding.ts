import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { z } from "zod";

import { runRegimeGenerationJob, screenOnboarding, upsertUserForOnboarding } from "@rebound/agents";

import { onboardingSubmissionSchema } from "../schemas";
import { protectedProcedure, router } from "../trpc";

export const onboardingRouter = router({
  submit: protectedProcedure.input(onboardingSubmissionSchema).mutation(async ({ ctx, input }) => {
    const screening = await screenOnboarding(input);

    if (screening.crisisFlagged) {
      return { status: "crisis_detected" as const, reasons: screening.crisisReasons };
    }

    if (screening.flagged) {
      return { status: "red_flagged" as const, reasons: screening.reasons };
    }

    // Regime-generation limiter: at most 1 new regime per Flow B cycle
    // (7 days) while one is actively running — mirrors Flow B's own
    // adjustment cadence (apps/web/src/app/api/cron/flow-b/route.ts).
    // Deliberately restarting (regime.restart) ends the active regime
    // first, which clears this immediately — the limiter targets repeated
    // onboarding submissions while a regime is already active and young,
    // not a genuine restart.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActiveRegime = await ctx.prisma.regime.findFirst({
      where: { userId: ctx.userId, status: "ACTIVE", createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });
    if (recentActiveRegime) {
      return { status: "cooldown_active" as const, regimeCreatedAt: recentActiveRegime.createdAt };
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
      // this procedure runs outside real HTTP handling (e.g. via
      // createCaller in scripts/tests). Fall back to fire-and-forget.
      void runRegimeGenerationJob(job.id, ctx.userId, input);
    }

    return { status: "job_created" as const, jobId: job.id };
  }),

  getJobStatus: protectedProcedure.input(z.object({ jobId: z.string() })).query(async ({ ctx, input }) => {
    const job = await ctx.prisma.regimeGenerationJob.findUniqueOrThrow({
      where: { id: input.jobId },
      select: { id: true, userId: true, status: true, resultRegimeId: true, createdAt: true, completedAt: true },
    });

    if (job.userId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Deliberately excludes `error`/`retryCount`/`fallbackPresetId` — `error`
    // carries raw internal exception text (Prisma/Anthropic SDK messages),
    // never safe to forward to the client that triggered the failure.
    return {
      id: job.id,
      status: job.status,
      resultRegimeId: job.resultRegimeId,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }),
});
