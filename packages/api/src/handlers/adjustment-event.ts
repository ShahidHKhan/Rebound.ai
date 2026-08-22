import type { AdjustmentEventResponse } from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

// Backs both the Adjustment explainer (most recent event affecting the
// active regime) and the full Adjustment history log — same shape serves
// both, callers just slice/filter client-side.
export async function listAdjustmentEvents(ctx: Ctx): Promise<AdjustmentEventResponse[]> {
  const events = await ctx.prisma.adjustmentEvent.findMany({
    where: { userId: ctx.userId },
    orderBy: { triggeredAt: "desc" },
    include: {
      fromRegime: { select: { versionNumber: true } },
      toRegime: { select: { versionNumber: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    userId: e.userId,
    fromRegimeVersionId: e.fromRegimeVersionId,
    toRegimeVersionId: e.toRegimeVersionId,
    triggeredAt: e.triggeredAt.toISOString(),
    triggerType: e.triggerType,
    trailingWindowUsed: e.trailingWindowUsed,
    rationale: e.rationale,
    wasReversed: e.wasReversed,
    fromRegime: e.fromRegime,
    toRegime: e.toRegime,
  }));
}
