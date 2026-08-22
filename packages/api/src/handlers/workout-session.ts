import type {
  CompleteWorkoutSessionInput,
  CompleteWorkoutSessionResponse,
  SessionLogResponse,
  WorkoutSessionResponse,
  WorkoutSessionTodayResponse,
} from "@rebound/contracts";

import type { Prisma, PrismaClient } from "@rebound/db";

import { computeSessionTimes, startOfToday, startOfTodayUTC } from "../date-utils";
import { ApiError } from "../errors";
import { computeCurrentStreak } from "../streak";
import { toRegimeExerciseListResponse } from "./regime";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

async function getCurrentStreak(userId: string, prisma: PrismaClient | Prisma.TransactionClient): Promise<number> {
  const completedSessions = await prisma.workoutSession.findMany({
    where: { userId, completedAt: { not: null } },
    select: { date: true },
    distinct: ["date"],
  });

  const completedDays = new Set(completedSessions.map((s) => s.date.toISOString().slice(0, 10)));
  // UTC-anchored to match completedDays' toISOString()-derived keys — see
  // date-utils.ts's startOfToday/startOfTodayUTC comments. startOfToday
  // (local) stays reserved for this file's other use, scheduling today's
  // WorkoutSession rows via computeSessionTimes.
  return computeCurrentStreak(completedDays, startOfTodayUTC());
}

function toWorkoutSessionResponse(session: {
  id: string;
  userId: string;
  regimeVersionId: string;
  date: Date;
  slot: "MORNING" | "EVENING";
  scheduledAt: Date;
  completedAt: Date | null;
  durationSeconds: number | null;
}): WorkoutSessionResponse {
  return {
    id: session.id,
    userId: session.userId,
    regimeVersionId: session.regimeVersionId,
    date: session.date.toISOString(),
    slot: session.slot,
    scheduledAt: session.scheduledAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    durationSeconds: session.durationSeconds,
  };
}

function toSessionLogResponse(log: {
  id: string;
  userId: string;
  regimeVersionId: string;
  loggedAt: Date;
  painScore: number;
  mobilityStrengthIndicator: unknown;
  completed: boolean;
  perceivedExertion: number | null;
  flag: boolean;
}): SessionLogResponse {
  return {
    id: log.id,
    userId: log.userId,
    regimeVersionId: log.regimeVersionId,
    loggedAt: log.loggedAt.toISOString(),
    painScore: log.painScore,
    mobilityStrengthIndicator: log.mobilityStrengthIndicator,
    completed: log.completed,
    perceivedExertion: log.perceivedExertion,
    flag: log.flag,
  };
}

// Everything the home screen needs in one round trip. Mirrors
// packages/api/src/routers/workout-session.ts's today exactly, including
// the same-day WorkoutSession-row backfill (a known gap, documented in the
// tRPC version's own comment — migrated byte-for-byte, not fixed here; that
// would be a separate product decision, not a transport migration concern).
export async function getWorkoutSessionToday(ctx: Ctx): Promise<WorkoutSessionTodayResponse> {
  const today = startOfToday();

  const [activeRegime, streak] = await Promise.all([
    ctx.prisma.regime.findFirst({
      where: { userId: ctx.userId, status: "ACTIVE" },
      include: { exerciseList: { orderBy: { orderIndex: "asc" }, include: { exercise: true } } },
    }),
    getCurrentStreak(ctx.userId, ctx.prisma),
  ]);

  if (!activeRegime) {
    return { regime: null, sessions: [], todaysLog: null, streak };
  }

  // Scoped to the active regime specifically, not just userId+date — a
  // same-day regime change (restart, escalation rollback) must not pick up
  // a *different* regime's leftover rows for today.
  let sessions = await ctx.prisma.workoutSession.findMany({
    where: { userId: ctx.userId, regimeVersionId: activeRegime.id, date: today },
    orderBy: { slot: "asc" },
  });

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
      where: { userId: ctx.userId, regimeVersionId: activeRegime.id, date: today },
      orderBy: { slot: "asc" },
    });
  }

  const todaysLog = await ctx.prisma.sessionLog.findFirst({
    where: { userId: ctx.userId, loggedAt: { gte: today } },
    orderBy: { loggedAt: "desc" },
  });

  return {
    regime: {
      id: activeRegime.id,
      userId: activeRegime.userId,
      versionNumber: activeRegime.versionNumber,
      createdAt: activeRegime.createdAt.toISOString(),
      createdBy: activeRegime.createdBy,
      status: activeRegime.status,
      endReason: activeRegime.endReason,
      sourcePresetId: activeRegime.sourcePresetId,
      parentRegimeId: activeRegime.parentRegimeId,
      exerciseList: toRegimeExerciseListResponse(activeRegime.exerciseList),
    },
    sessions: sessions.map(toWorkoutSessionResponse),
    todaysLog: todaysLog ? toSessionLogResponse(todaysLog) : null,
    streak,
  };
}

export async function completeWorkoutSession(
  ctx: Ctx,
  input: { workoutSessionId: string } & CompleteWorkoutSessionInput
): Promise<CompleteWorkoutSessionResponse> {
  const session = await ctx.prisma.workoutSession.findUniqueOrThrow({
    where: { id: input.workoutSessionId },
  });

  if (session.userId !== ctx.userId) {
    throw new ApiError("FORBIDDEN");
  }

  // Idempotent: a second completion (e.g. the guided session's "Finish"
  // racing the quick-complete button, or a retried request) must not
  // overwrite an already-recorded completedAt/durationSeconds with a later
  // timestamp — there is no un-complete path anywhere in this codebase, so
  // the first completion should be the one that sticks.
  if (session.completedAt) {
    return {
      workoutSessionId: session.id,
      completedAt: session.completedAt.toISOString(),
      durationSeconds: session.durationSeconds,
    };
  }

  const updated = await ctx.prisma.workoutSession.update({
    where: { id: input.workoutSessionId },
    data: { completedAt: new Date(), durationSeconds: input.durationSeconds ?? null },
  });

  return {
    workoutSessionId: updated.id,
    completedAt: updated.completedAt?.toISOString() ?? null,
    durationSeconds: updated.durationSeconds,
  };
}
