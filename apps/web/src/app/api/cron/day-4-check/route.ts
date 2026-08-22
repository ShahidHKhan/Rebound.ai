import { NextResponse } from "next/server";

import { applyEscalationRollback } from "@rebound/agents";
import { sweepExpired } from "@rebound/api";
import { checkEscalation } from "@rebound/clinical-rules";
import type { SessionLogEntry } from "@rebound/clinical-rules";
import { prisma } from "@rebound/db";

// Day-4 post-rollback check (Clinical Risk Framing > Post-rollback cadence).
// Not on a routine cadence — only fires for users whose escalation rollback
// happened exactly 4 days ago. Rules-only, no LLM call.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const fourDaysAgoStart = new Date();
  fourDaysAgoStart.setDate(fourDaysAgoStart.getDate() - 4);
  fourDaysAgoStart.setHours(0, 0, 0, 0);
  const fourDaysAgoEnd = new Date(fourDaysAgoStart);
  fourDaysAgoEnd.setHours(23, 59, 59, 999);

  // Housekeeping, not correctness: consume() already treats an expired row as
  // a fresh window, so this only reclaims space. Rides along with an existing
  // daily job rather than earning a schedule (and a vercel.json entry) of its
  // own. Failure here must never fail the day-4 check, hence the catch.
  const sweptRateLimits = await sweepExpired().catch((err) => {
    console.error("Rate limit sweep failed (non-fatal):", err);
    return 0;
  });

  const rollbacks = await prisma.adjustmentEvent.findMany({
    where: {
      triggerType: "ESCALATION_ROLLBACK",
      triggeredAt: { gte: fourDaysAgoStart, lte: fourDaysAgoEnd },
    },
  });

  const results: Array<{ userId: string; outcome: string }> = [];

  for (const rollback of rollbacks) {
    // Baseline: the pain score that actually triggered the rollback.
    const triggeringLog = await prisma.sessionLog.findFirst({
      where: { userId: rollback.userId, loggedAt: { lte: rollback.triggeredAt } },
      orderBy: { loggedAt: "desc" },
    });

    if (!triggeringLog) {
      results.push({ userId: rollback.userId, outcome: "inconclusive_no_baseline" });
      continue;
    }

    const logsSinceRollback = await prisma.sessionLog.findMany({
      where: { userId: rollback.userId, loggedAt: { gt: rollback.triggeredAt } },
      orderBy: { loggedAt: "desc" },
    });

    if (logsSinceRollback.length === 0) {
      results.push({ userId: rollback.userId, outcome: "inconclusive_no_logs_since" });
      continue;
    }

    const staysControlled = logsSinceRollback.every((log) => log.painScore <= triggeringLog.painScore);

    if (staysControlled) {
      // Yes -> resume normal 7-day cycle, no LLM call needed. Flow B's own
      // due-query already anchors to this rollback event naturally, so
      // there's nothing further to do here.
      results.push({ userId: rollback.userId, outcome: "resumed_normal_cycle" });
      continue;
    }

    // No -> the same escalation-monitor thresholds apply as always.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: rollback.userId } });
    const recentLogs = await prisma.sessionLog.findMany({
      where: { userId: rollback.userId },
      orderBy: { loggedAt: "desc" },
      take: 3,
    });
    const entries: SessionLogEntry[] = recentLogs.map((l) => ({
      date: l.loggedAt.toISOString().slice(0, 10),
      painScore: l.painScore,
      madeItWorseFlag: l.flag,
    }));

    const escalation = checkEscalation(entries, user.riskTier);

    if (escalation.action === "rollback") {
      const activeRegime = await prisma.regime.findFirst({ where: { userId: rollback.userId, status: "ACTIVE" } });
      if (activeRegime) {
        await applyEscalationRollback(
          rollback.userId,
          activeRegime.id,
          activeRegime.parentRegimeId,
          escalation,
          entries.length
        );
        results.push({ userId: rollback.userId, outcome: "re_escalated_rollback" });
      } else {
        results.push({ userId: rollback.userId, outcome: "error_no_active_regime" });
      }
    } else {
      results.push({ userId: rollback.userId, outcome: `not_settled_but_action_${escalation.action}` });
    }
  }

  return NextResponse.json({ checked: results.length, results, sweptRateLimits });
}
