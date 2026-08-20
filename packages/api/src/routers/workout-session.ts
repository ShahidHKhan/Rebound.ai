import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@rebound/db";
import { z } from "zod";

import { computeSessionTimes, startOfToday } from "../date-utils";
import { computeCurrentStreak } from "../streak";
import { protectedProcedure, router } from "../trpc";

async function getCurrentStreak(
  userId: string,
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<number> {
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

    let sessions = await ctx.prisma.workoutSession.findMany({
      where: { userId: ctx.userId, date: today },
      orderBy: { slot: "asc" },
    });

    // Known gap (see HANDOFF): WorkoutSession rows were only ever created
    // once, at regime.activate time, for that exact calendar day — nothing
    // provisions the next day's rows. Concretely: activate at 11:22pm, and
    // by the time "today" rolls over, this query finds nothing, both
    // SessionCards render with no matching session, and their "Mark
    // complete" buttons end up permanently disabled (not erroring — just
    // silently doing nothing when clicked, confirmed live 2026-08-20).
    // Self-heals here rather than requiring a new cron: any day this loads
    // with an active regime and no rows yet for today, create them using
    // the same time computation regime.activate already uses.
    if (sessions.length === 0) {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { wakeTimeMinutes: true, eveningTimeMinutes: true },
      });
      const { morningTime, eveningTime } = computeSessionTimes(today, user.wakeTimeMinutes, user.eveningTimeMinutes);

      await ctx.prisma.workoutSession.createMany({
        data: [
          { userId: ctx.userId, regimeVersionId: activeRegime.id, date: today, slot: "MORNING", scheduledAt: morningTime },
          { userId: ctx.userId, regimeVersionId: activeRegime.id, date: today, slot: "EVENING", scheduledAt: eveningTime },
        ],
        skipDuplicates: true,
      });

      sessions = await ctx.prisma.workoutSession.findMany({
        where: { userId: ctx.userId, date: today },
        orderBy: { slot: "asc" },
      });
    }

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
