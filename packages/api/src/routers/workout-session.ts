import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@rebound/db";
import { z } from "zod";

import { computeCurrentStreak } from "../streak";
import { protectedProcedure, router } from "../trpc";

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

async function getCurrentStreak(userId: string, prisma: PrismaClient): Promise<number> {
  const completedSessions = await prisma.workoutSession.findMany({
    where: { userId, completedAt: { not: null } },
    select: { date: true },
    distinct: ["date"],
  });

  const completedDays = new Set(completedSessions.map((s) => s.date.toISOString().slice(0, 10)));
  return computeCurrentStreak(completedDays, startOfToday());
}

export const workoutSessionRouter = router({
  // Everything the home screen needs in one round trip: the active regime
  // (for the exercise list per slot), today's two WorkoutSession rows
  // (created by regime.activate), whether today's Session Log already
  // exists (bundling the stat/pain check-in with the morning session per
  // Daily Session Structure), and the current streak.
  today: protectedProcedure.query(async ({ ctx }) => {
    const today = startOfToday();

    const [activeRegime, streak] = await Promise.all([
      ctx.prisma.regime.findFirst({
        where: { userId: ctx.userId, status: "ACTIVE" },
        include: {
          exerciseList: {
            orderBy: { orderIndex: "asc" },
            include: { exercise: true },
          },
        },
      }),
      getCurrentStreak(ctx.userId, ctx.prisma),
    ]);

    if (!activeRegime) {
      return { regime: null, sessions: [], todaysLog: null, streak };
    }

    const sessions = await ctx.prisma.workoutSession.findMany({
      where: { userId: ctx.userId, date: today },
      orderBy: { slot: "asc" },
    });

    const todaysLog = await ctx.prisma.sessionLog.findFirst({
      where: { userId: ctx.userId, loggedAt: { gte: today } },
      orderBy: { loggedAt: "desc" },
    });

    return { regime: activeRegime, sessions, todaysLog, streak };
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
