import { TRPCError } from "@trpc/server";
import { validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { DraftRegime } from "@rebound/clinical-rules";
import { z } from "zod";

import { computeSessionTimes, startOfToday } from "../date-utils";
import { protectedProcedure, router } from "../trpc";

const restartReasonCodeSchema = z.enum(["GOALS_CHANGED", "STARTING_OVER", "OTHER"]);

const exerciseEditSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(10).optional(),
  reps: z.number().int().min(1).max(50).optional(),
  durationSeconds: z.number().int().min(5).max(1800).optional(),
  frequency: z.string().max(50).optional(),
  sessionSlot: z.enum(["MORNING", "EVENING"]),
});

export const regimeRouter = router({
  getById: protectedProcedure.input(z.object({ regimeId: z.string() })).query(async ({ ctx, input }) => {
    const regime = await ctx.prisma.regime.findUniqueOrThrow({
      where: { id: input.regimeId },
      include: {
        exerciseList: {
          orderBy: { orderIndex: "asc" },
          include: { exercise: true },
        },
        // Null for freeform-generated, USER_EDITED, or PRESET_FALLBACK
        // regimes — the review screen only renders a "Program source"
        // section when this is present.
        sourcePreset: {
          include: { slots: { orderBy: { orderIndex: "asc" } } },
        },
      },
    });

    if (regime.userId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return regime;
  }),

  activate: protectedProcedure
    .input(
      z.object({
        regimeId: z.string(),
        // Present only if the user edited the draft before activating.
        exercises: z.array(exerciseEditSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const regime = await ctx.prisma.regime.findUniqueOrThrow({
        where: { id: input.regimeId },
        include: { exerciseList: true },
      });

      if (regime.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (regime.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Regime is already ${regime.status}, not DRAFT` });
      }

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

      const finalExercises =
        input.exercises ??
        regime.exerciseList.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets ?? undefined,
          reps: e.reps ?? undefined,
          durationSeconds: e.durationSeconds ?? undefined,
          frequency: e.frequency ?? undefined,
          sessionSlot: e.sessionSlot,
        }));

      if (input.exercises) {
        const draft: DraftRegime = { exercises: finalExercises };
        const structural = validateStructure(draft);
        if (!structural.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Structural validation failed: ${JSON.stringify(structural.error.issues)}`,
          });
        }
        const clinical = validateRegime(draft, user.riskTier);
        if (!clinical.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Clinical validation failed: ${clinical.issues.map((i) => i.message).join("; ")}`,
          });
        }
      }

      const today = startOfToday();

      // No inner $transaction here — ctx.prisma is already a transaction
      // client for the whole request (RLS middleware, packages/api/src/trpc.ts),
      // so these writes are already atomic without nesting one.
      if (input.exercises) {
        await ctx.prisma.regimeExercise.deleteMany({ where: { regimeId: regime.id } });
      }

      // Defensive: without this, activating a second draft while one regime
      // is already ACTIVE leaves two ACTIVE rows for the same user, and
      // every "find the active regime" query elsewhere (workoutSession.today,
      // sessionLog.create, flow-b-runner.ts) does an unordered findFirst —
      // which one comes back would be arbitrary. Real, reachable today (two
      // onboarding.submit calls, both drafts activated), not hypothetical.
      await ctx.prisma.regime.updateMany({
        where: { userId: ctx.userId, status: "ACTIVE", id: { not: regime.id } },
        data: { status: "SUPERSEDED" },
      });

      const updated = await ctx.prisma.regime.update({
        where: { id: regime.id },
        data: {
          status: "ACTIVE",
          createdBy: input.exercises ? "USER_EDITED" : regime.createdBy,
          ...(input.exercises
            ? {
                exerciseList: {
                  create: finalExercises.map((exercise, index) => ({
                    exerciseId: exercise.exerciseId,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    durationSeconds: exercise.durationSeconds,
                    frequency: exercise.frequency,
                    sessionSlot: exercise.sessionSlot,
                    orderIndex: index,
                  })),
                },
              }
            : {}),
        },
        include: { exerciseList: true },
      });

      const { morningTime, eveningTime } = computeSessionTimes(today, user.wakeTimeMinutes, user.eveningTimeMinutes);

      await ctx.prisma.workoutSession.createMany({
        data: [
          {
            userId: ctx.userId,
            regimeVersionId: updated.id,
            date: today,
            slot: "MORNING",
            scheduledAt: morningTime,
          },
          {
            userId: ctx.userId,
            regimeVersionId: updated.id,
            date: today,
            slot: "EVENING",
            scheduledAt: eveningTime,
          },
        ],
        skipDuplicates: true,
      });

      return { regimeId: updated.id, exerciseCount: updated.exerciseList.length };
    }),

  // Self-service "start over" — ends the user's active regime (kept in
  // history, not deleted) so they can go through onboarding again. Ending
  // it explicitly is also what clears onboarding.submit's regime-generation
  // cooldown immediately, rather than making them wait out the 7 days.
  restart: protectedProcedure
    .input(z.object({ reasonCode: restartReasonCodeSchema, comment: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const activeRegime = await ctx.prisma.regime.findFirst({
        where: { userId: ctx.userId, status: "ACTIVE" },
      });

      if (!activeRegime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active regime to restart." });
      }

      const endReason = input.comment ? `${input.reasonCode}: ${input.comment}` : input.reasonCode;

      await ctx.prisma.regime.update({
        where: { id: activeRegime.id },
        data: { status: "ENDED", endReason },
      });

      return { success: true as const };
    }),
});
