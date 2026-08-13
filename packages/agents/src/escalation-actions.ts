import { prisma } from "@rebound/db";
import type { EscalationResult } from "@rebound/clinical-rules";

// Shared by the real-time Session Log write path and the day-4
// post-rollback check — both need to actually apply a "rollback" decision
// to a user's regime, not just detect one.
export async function applyEscalationRollback(
  userId: string,
  activeRegimeId: string,
  parentRegimeId: string | null,
  escalation: EscalationResult,
  trailingWindowUsed: number
): Promise<void> {
  if (parentRegimeId) {
    await prisma.$transaction([
      prisma.regime.update({ where: { id: activeRegimeId }, data: { status: "SUPERSEDED" } }),
      prisma.regime.update({ where: { id: parentRegimeId }, data: { status: "ACTIVE" } }),
      prisma.adjustmentEvent.create({
        data: {
          userId,
          fromRegimeVersionId: activeRegimeId,
          toRegimeVersionId: parentRegimeId,
          triggerType: "ESCALATION_ROLLBACK",
          trailingWindowUsed,
          rationale: escalation.reasons.join("; "),
        },
      }),
    ]);
  } else {
    // No prior version exists — nothing to revert to. Still log the event
    // for audit visibility.
    await prisma.adjustmentEvent.create({
      data: {
        userId,
        fromRegimeVersionId: activeRegimeId,
        toRegimeVersionId: activeRegimeId,
        triggerType: "ESCALATION_ROLLBACK",
        trailingWindowUsed,
        rationale: `${escalation.reasons.join("; ")} (no prior regime version to roll back to)`,
      },
    });
  }
}
