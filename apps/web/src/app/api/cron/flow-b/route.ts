import { NextResponse } from "next/server";

import { runFlowBForUser } from "@rebound/agents";
import { prisma } from "@rebound/db";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeRegimes = await prisma.regime.findMany({
    where: { status: "ACTIVE", user: { manualHold: false } },
    select: {
      userId: true,
      createdAt: true,
      user: { select: { subscriptionActive: true } },
    },
  });

  const results: Array<{ userId: string; status: string; error?: string }> = [];

  for (const regime of activeRegimes) {
    const lastEvent = await prisma.adjustmentEvent.findFirst({
      where: { userId: regime.userId },
      orderBy: { triggeredAt: "desc" },
    });

    const anchor = lastEvent?.triggeredAt ?? regime.createdAt;
    if (anchor > sevenDaysAgo) continue;

    if (!regime.user.subscriptionActive) {
      const trialAdjustmentUsed = await prisma.adjustmentEvent.findFirst({
        where: { userId: regime.userId, triggerType: "SCHEDULED_ADJUSTMENT" },
        select: { id: true },
      });

      if (trialAdjustmentUsed) {
        results.push({ userId: regime.userId, status: "skipped_trial_locked" });
        continue;
      }
    }

    try {
      const result = await runFlowBForUser(regime.userId);
      results.push({ userId: regime.userId, status: result.status });
    } catch (error) {
      results.push({
        userId: regime.userId,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
