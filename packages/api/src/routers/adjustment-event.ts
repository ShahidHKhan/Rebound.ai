import { protectedProcedure, router } from "../trpc";

// Backs both the Adjustment explainer (most recent event affecting the
// active regime) and the full Adjustment history log — same shape serves
// both, callers just slice/filter client-side. Scoped to ctx.userId; RLS
// (adjustment_events_isolation) also enforces this at the DB layer.
export const adjustmentEventRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.adjustmentEvent.findMany({
      where: { userId: ctx.userId },
      orderBy: { triggeredAt: "desc" },
      include: {
        fromRegime: { select: { versionNumber: true } },
        toRegime: { select: { versionNumber: true } },
      },
    });
  }),
});
