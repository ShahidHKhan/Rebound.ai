import { prisma } from "@rebound/db";
import type { EscalationResult } from "@rebound/clinical-rules";

// Data Model: AdjustmentEvent.wasReversed is "set retroactively" — this is
// where that retroactive marking actually happens. Scoped deliberately to
// escalation rollbacks only: that's the one structurally-unambiguous
// "walk-back" signal in this data model. Regime versioning is a single
// linear chain per user (versionNumber strictly increasing); Flow B's own
// scheduled adjustments always create a NEW higher version regardless of
// whether the LLM's decision was "progress" or "rollback" (that distinction
// only lives in free-text rationale, not a structured column), so it can't
// be reliably detected as "undoing" a prior event without fuzzy heuristics.
// Escalation rollback, by contrast, always reactivates an existing earlier
// version — a real, queryable regression. An event E (fromRegime at version
// vE) counts as reversed once a later escalation rollback lands the active
// regime back at version vE or earlier, for either trigger type — matching
// the PRD's "tracked across both scheduled_adjustment and escalation_rollback
// trigger types" framing for the reversal-rate metric.
async function markReversedEvents(
  userId: string,
  rolledBackToRegimeId: string,
  excludeEventId: string
): Promise<void> {
  const target = await prisma.regime.findUniqueOrThrow({
    where: { id: rolledBackToRegimeId },
    select: { versionNumber: true },
  });

  const candidates = await prisma.adjustmentEvent.findMany({
    where: { userId, wasReversed: false, id: { not: excludeEventId } },
    include: { fromRegime: { select: { versionNumber: true } } },
  });

  const idsToReverse = candidates
    .filter((e) => e.fromRegimeVersionId !== e.toRegimeVersionId) // holds changed nothing — nothing to reverse
    .filter((e) => e.fromRegime.versionNumber >= target.versionNumber)
    .map((e) => e.id);

  if (idsToReverse.length > 0) {
    await prisma.adjustmentEvent.updateMany({
      where: { id: { in: idsToReverse } },
      data: { wasReversed: true },
    });
  }
}

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
    const [, , rollbackEvent] = await prisma.$transaction([
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
    // Exclude the rollback event itself — it shouldn't be able to mark
    // itself as reversed just because its own fromRegime outranks the
    // target version.
    await markReversedEvents(userId, parentRegimeId, rollbackEvent.id);
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
