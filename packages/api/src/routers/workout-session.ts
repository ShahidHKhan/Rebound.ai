import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export const workoutSessionRouter = router({
  // Everything the home screen needs in one round trip: the active regime
  // (for the exercise list per slot), today's two WorkoutSession rows
  // (created by regime.activate), and whether today's Session Log already
  // exists — bundling the stat/pain check-in with the morning session per
  // Daily Session Structure.
  today: protectedProcedure.query(async ({ ctx }) => {
    const today = startOfToday();

    const activeRegime = await ctx.prisma.regime.findFirst({
      where: { userId: ctx.userId, status: "ACTIVE" },
      include: {
        exerciseList: {
          orderBy: { orderIndex: "asc" },
          include: { exercise: true },
        },
      },
    });

    if (!activeRegime) {
      return { regime: null, sessions: [], todaysLog: null };
    }

    const sessions = await ctx.prisma.workoutSession.findMany({
      where: { userId: ctx.userId, date: today },
      orderBy: { slot: "asc" },
    });

    const todaysLog = await ctx.prisma.sessionLog.findFirst({
      where: { userId: ctx.userId, loggedAt: { gte: today } },
      orderBy: { loggedAt: "desc" },
    });

    return { regime: activeRegime, sessions, todaysLog };
  }),

  complete: protectedProcedure
    .input(z.object({ workoutSessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.workoutSession.findUniqueOrThrow({
        where: { id: input.workoutSessionId },
      });

      if (session.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updated = await ctx.prisma.workoutSession.update({
        where: { id: input.workoutSessionId },
        data: { completedAt: new Date() },
      });

      return { workoutSessionId: updated.id, completedAt: updated.completedAt };
    }),
});
