import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { z } from "zod";

import { runRegimeGenerationJob, screenOnboarding, upsertUserForOnboarding } from "@rebound/agents";

import { protectedProcedure, router } from "../trpc";

const redFlagAnswersSchema = z.object({
  severeSuddenPain: z.boolean(),
  numbnessOrTingling: z.boolean(),
  recentTrauma: z.boolean(),
  recentSurgery: z.boolean(),
  pregnancyRelated: z.boolean(),
  cardiacSymptomsWithExertion: z.boolean(),
});

const onboardingAnswersSchema = z.object({
  age: z.number().int().min(13).max(120),
  goalType: z.enum(["INJURY_RECOVERY", "STRENGTH", "MOBILITY", "GENERAL_FITNESS"]),
  conditionFlags: z.array(z.string()),
  injurySeverity: z.enum(["none", "mild", "moderate", "severe"]),
  redFlags: redFlagAnswersSchema,
});

// Free-Text Input Handling: length-bounded (~500-750 chars) — controls
// token cost and shrinks the prompt-injection surface. First place this is
// actually enforced anywhere in the codebase.
const onboardingSubmissionSchema = z.object({
  answers: onboardingAnswersSchema,
  targetMovement: z.string().min(1).max(200),
  symptomsText: z.string().max(750),
  lifestyleContextText: z.string().max(750),
  // Daily Session Structure: morning "on wake", evening at a user-picked
  // time. Both optional — regime.activate falls back to 7am/6pm placeholders
  // when either is missing, so skipping these doesn't block onboarding.
  wakeTimeMinutes: z.number().int().min(0).max(1439).optional(),
  eveningTimeMinutes: z.number().int().min(0).max(1439).optional(),
});

export const onboardingRouter = router({
  submit: protectedProcedure.input(onboardingSubmissionSchema).mutation(async ({ ctx, input }) => {
    const screening = await screenOnboarding(input);

    if (screening.flagged) {
      return { status: "red_flagged" as const, reasons: screening.reasons };
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
    const job = await ctx.prisma.regimeGenerationJob.findUniqueOrThrow({ where: { id: input.jobId } });

    if (job.userId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return job;
  }),
});
