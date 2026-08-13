import { TRPCError } from "@trpc/server";
import { validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { DraftRegime } from "@rebound/clinical-rules";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const exerciseEditSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(10).optional(),
  reps: z.number().int().min(1).max(50).optional(),
  durationSeconds: z.number().int().min(5).max(1800).optional(),
  frequency: z.string().max(50).optional(),
  sessionSlot: z.enum(["MORNING", "EVENING"]),
});

export const regimeRouter = router({
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activated = await ctx.prisma.$transaction(async (tx) => {
        if (input.exercises) {
          await tx.regimeExercise.deleteMany({ where: { regimeId: regime.id } });
        }

        const updated = await tx.regime.update({
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

        // Placeholder scheduling — real wake/sunset timing is still an open
        // PRD item (Open Question #3).
        const morningTime = new Date(today);
        morningTime.setHours(7, 0, 0, 0);
        const eveningTime = new Date(today);
        eveningTime.setHours(18, 0, 0, 0);

        await tx.workoutSession.createMany({
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

        return updated;
      });

      return { regimeId: activated.id, exerciseCount: activated.exerciseList.length };
    }),
});
