import type { AdminMetricsResponse, FlaggedUsersResponse, SetManualHoldInput, SetManualHoldResponse } from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

import { ApiError } from "../errors";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

const FLAGGED_LOG_WINDOW_DAYS = 14;

// Flagged users list: anyone with an escalation_rollback AdjustmentEvent, a
// "made it worse" flag in the trailing window, or a failed
// RegimeGenerationJob — most recent first. Mirrors
// packages/api/src/routers/admin.ts's flaggedUsers exactly.
export async function getFlaggedUsers(ctx: Ctx): Promise<FlaggedUsersResponse> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - FLAGGED_LOG_WINDOW_DAYS);

  const [rollbacks, flaggedLogs, failedJobs] = await Promise.all([
    ctx.prisma.adjustmentEvent.findMany({
      where: { triggerType: "ESCALATION_ROLLBACK" },
      select: { userId: true, triggeredAt: true },
      orderBy: { triggeredAt: "desc" },
    }),
    ctx.prisma.sessionLog.findMany({
      where: { flag: true, loggedAt: { gte: windowStart } },
      select: { userId: true, loggedAt: true },
      orderBy: { loggedAt: "desc" },
    }),
    ctx.prisma.regimeGenerationJob.findMany({
      where: { status: "FAILED" },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byUser = new Map<string, { reasons: Set<string>; mostRecent: Date }>();

  function record(userId: string, reason: string, at: Date) {
    const existing = byUser.get(userId);
    if (existing) {
      existing.reasons.add(reason);
      if (at > existing.mostRecent) existing.mostRecent = at;
    } else {
      byUser.set(userId, { reasons: new Set([reason]), mostRecent: at });
    }
  }

  rollbacks.forEach((r) => record(r.userId, "escalation_rollback", r.triggeredAt));
  flaggedLogs.forEach((l) => record(l.userId, "made_it_worse_flag", l.loggedAt));
  failedJobs.forEach((j) => record(j.userId, "regime_generation_failed", j.createdAt));

  const users = await ctx.prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: { id: true, goalType: true, riskTier: true, manualHold: true, manualHoldReason: true, createdAt: true },
  });

  return users
    .map((user) => {
      const info = byUser.get(user.id)!;
      return {
        user: { ...user, createdAt: user.createdAt.toISOString() },
        reasons: [...info.reasons],
        mostRecent: info.mostRecent.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.mostRecent).getTime() - new Date(a.mostRecent).getTime());
}

export async function setManualHold(
  ctx: Ctx,
  input: { userId: string } & SetManualHoldInput
): Promise<SetManualHoldResponse> {
  if (input.manualHold && !input.reason?.trim()) {
    throw new ApiError("BAD_REQUEST", "A reason is required to enable manual hold.");
  }

  const updated = await ctx.prisma.user.update({
    where: { id: input.userId },
    data: {
      manualHold: input.manualHold,
      manualHoldReason: input.manualHold ? input.reason : null,
    },
  });

  return { userId: updated.id, manualHold: updated.manualHold, manualHoldReason: updated.manualHoldReason };
}

// Plain counts pulled from Postgres, computed in JS rather than raw SQL —
// fine at beta scale. Mirrors packages/api/src/routers/admin.ts's metrics
// exactly.
export async function getAdminMetrics(ctx: Ctx): Promise<AdminMetricsResponse> {
  const [totalUsers, regimeUsers, activeRegimeUsers, loggedUsers, flaggedLogCount, jobs, adjustmentEvents] =
    await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.regime.findMany({ distinct: ["userId"], select: { userId: true } }),
      ctx.prisma.regime.findMany({ where: { status: "ACTIVE" }, distinct: ["userId"], select: { userId: true } }),
      ctx.prisma.sessionLog.findMany({ distinct: ["userId"], select: { userId: true } }),
      ctx.prisma.sessionLog.count({ where: { flag: true } }),
      ctx.prisma.regimeGenerationJob.findMany({ select: { status: true } }),
      ctx.prisma.adjustmentEvent.findMany({
        select: { triggerType: true, fromRegimeVersionId: true, toRegimeVersionId: true, wasReversed: true },
      }),
    ]);

  const scheduledAdjustments = adjustmentEvents.filter((e) => e.triggerType === "SCHEDULED_ADJUSTMENT");
  const scheduledHolds = scheduledAdjustments.filter((e) => e.fromRegimeVersionId === e.toRegimeVersionId);
  const escalationRollbacks = adjustmentEvents.filter((e) => e.triggerType === "ESCALATION_ROLLBACK");

  return {
    activationFunnel: {
      totalUsers,
      regimeGenerated: regimeUsers.length,
      regimeActivated: activeRegimeUsers.length,
      loggedAtLeastOnce: loggedUsers.length,
    },
    adverseEvents: {
      flaggedSessionLogs: flaggedLogCount,
      escalationRollbacks: escalationRollbacks.length,
    },
    flowFailures: {
      flowAJobsTotal: jobs.length,
      flowAJobsFailed: jobs.filter((j) => j.status === "FAILED").length,
      flowBScheduledAdjustments: scheduledAdjustments.length,
      flowBScheduledHolds: scheduledHolds.length,
    },
    reversalRate: {
      totalAdjustmentEvents: adjustmentEvents.length,
      markedReversed: adjustmentEvents.filter((e) => e.wasReversed).length,
      note: "wasReversed is not currently set by any job — not yet a meaningful signal.",
    },
  };
}
