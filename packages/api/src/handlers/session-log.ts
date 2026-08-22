import { applyEscalationRollback } from "@rebound/agents";
import { checkEscalation } from "@rebound/clinical-rules";
import type { SessionLogEntry } from "@rebound/clinical-rules";

import type { CreateSessionLogInput, CreateSessionLogResponse, SessionLogResponse } from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

import { startOfTodayUTC } from "../date-utils";
import { ApiError } from "../errors";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

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

// History / trend screen: every SessionLog for this user, most recent
// first. Scoped to ctx.userId; RLS (session_logs_isolation) also enforces
// this at the DB layer.
export async function listSessionLogs(ctx: Ctx): Promise<SessionLogResponse[]> {
  const logs = await ctx.prisma.sessionLog.findMany({
    where: { userId: ctx.userId },
    orderBy: { loggedAt: "desc" },
  });
  return logs.map(toSessionLogResponse);
}

// Mirrors packages/api/src/routers/session-log.ts's create exactly — same
// once-daily guard, same real-time escalation monitor run inline on every
// write (decoupled from Flow B's cadence), same manualHold skip-check. This
// is the highest-drift-risk handler in the whole migration; do not change
// this ordering or the trailing-window size (3) without re-reading the
// escalation monitor's own docs first.
export async function createSessionLog(ctx: Ctx, input: CreateSessionLogInput): Promise<CreateSessionLogResponse> {
  const activeRegime = await ctx.prisma.regime.findFirstOrThrow({
    where: { userId: ctx.userId, status: "ACTIVE" },
  });

  // Daily Session Structure: stat logging happens once daily. The
  // @@unique([userId, loggedAt]) constraint doesn't actually enforce this
  // (loggedAt defaults to the exact submission instant), so it has to be
  // checked explicitly here. UTC-anchored (not startOfToday's local
  // midnight) so this boundary agrees with toDateKey's UTC-day grouping —
  // see startOfToday's own comment in date-utils.ts for the bug this fixes.
  const existingLogToday = await ctx.prisma.sessionLog.findFirst({
    where: { userId: ctx.userId, loggedAt: { gte: startOfTodayUTC() } },
  });
  if (existingLogToday) {
    throw new ApiError("CONFLICT", "You've already logged today.");
  }

  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

  const log = await ctx.prisma.sessionLog.create({
    data: {
      userId: ctx.userId,
      regimeVersionId: activeRegime.id,
      painScore: input.painScore,
      flag: input.flag,
      perceivedExertion: input.perceivedExertion,
    },
  });

  // Real-time escalation monitor — runs inline on every write, decoupled
  // from Flow B's cadence (Clinical Risk Framing > Escalation monitor).
  const recentLogs = await ctx.prisma.sessionLog.findMany({
    where: { userId: ctx.userId },
    orderBy: { loggedAt: "desc" },
    take: 3,
  });

  const entries: SessionLogEntry[] = recentLogs.map((l) => ({
    date: l.loggedAt.toISOString().slice(0, 10),
    painScore: l.painScore,
    madeItWorseFlag: l.flag,
  }));

  const escalation = checkEscalation(entries, user.riskTier);

  // Admin panel > Manual override: both the escalation monitor and Flow B
  // must skip automated action for a manually-held user.
  if (escalation.action === "rollback" && !user.manualHold) {
    await applyEscalationRollback(
      ctx.userId,
      activeRegime.id,
      activeRegime.parentRegimeId,
      escalation,
      entries.length
    );
  }

  return { sessionLogId: log.id, escalation };
}
