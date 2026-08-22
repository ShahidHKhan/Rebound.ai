import type { MilestonesResponse, ProgressSummaryResponse, StreakCalendarResponse } from "@rebound/contracts";

import type { Prisma, PrismaClient } from "@rebound/db";

import { addDays, daysBetween, startOfToday, toDateKey } from "../date-utils";
import { computeMilestones } from "../milestones";
import { computeCurrentStreak } from "../streak";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };
type Db = PrismaClient | Prisma.TransactionClient;

const PAIN_TREND_DAYS = 60;
const CALENDAR_DAYS = 60;

// Shared by getProgressSummary/getStreakCalendar/getMilestones — mirrors
// packages/api/src/routers/progress.ts's getProgressData exactly.
async function getProgressData(userId: string, prisma: Db) {
  const today = startOfToday();
  const trendStart = addDays(today, -(PAIN_TREND_DAYS - 1));

  const [painLogs, allSessions, completedSessionDates, firstSession, user] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { userId, loggedAt: { gte: trendStart } },
      orderBy: { loggedAt: "asc" },
      select: { loggedAt: true, painScore: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      select: { completedAt: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, completedAt: { not: null } },
      select: { date: true },
      distinct: ["date"],
    }),
    prisma.workoutSession.findFirst({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  const painTrend = painLogs.map((log) => ({ date: toDateKey(log.loggedAt), painScore: log.painScore }));

  const totalSessions = allSessions.length;
  const completedSessions = allSessions.filter((s) => s.completedAt !== null).length;
  const adherencePct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : null;

  const completedDays = new Set(completedSessionDates.map((s) => toDateKey(s.date)));
  const streak = computeCurrentStreak(completedDays, today);

  // "weeks active" per the task spec: earliest WorkoutSession, falling back
  // to User.createdAt if the user has never had an active regime yet.
  const earliestDate = firstSession?.date ?? user.createdAt;
  const daysActive = Math.max(0, daysBetween(earliestDate, today));
  const weeksActive = Math.max(1, Math.ceil((daysActive + 1) / 7));

  return { painTrend, totalSessions, completedSessions, adherencePct, completedDays, streak, weeksActive, today };
}

export async function getProgressSummary(ctx: Ctx): Promise<ProgressSummaryResponse> {
  const data = await getProgressData(ctx.userId, ctx.prisma);
  return {
    painTrend: data.painTrend,
    adherencePct: data.adherencePct,
    completedSessions: data.completedSessions,
    totalSessions: data.totalSessions,
    weeksActive: data.weeksActive,
    streak: data.streak,
  };
}

export async function getStreakCalendar(ctx: Ctx): Promise<StreakCalendarResponse> {
  const data = await getProgressData(ctx.userId, ctx.prisma);
  const windowStart = addDays(data.today, -(CALENDAR_DAYS - 1));

  const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const date = addDays(windowStart, i);
    const key = toDateKey(date);
    return { date: key, completed: data.completedDays.has(key) };
  });

  return { days, streak: data.streak };
}

export async function getMilestones(ctx: Ctx): Promise<MilestonesResponse> {
  const data = await getProgressData(ctx.userId, ctx.prisma);
  return computeMilestones({
    streak: data.streak,
    weeksActive: data.weeksActive,
    painTrend: data.painTrend,
  });
}
