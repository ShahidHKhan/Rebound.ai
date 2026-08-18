import { prisma } from "@rebound/db";
import { validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { DraftRegime, RiskTier } from "@rebound/clinical-rules";

import { proposeAdjustment } from "./flow-b";
import type { AdjustmentContext, ProposedAdjustment } from "./flow-b";

const TRAILING_WINDOW_DAYS = 7;

export type FlowBResult =
  | { status: "held"; reason: string }
  | { status: "adjusted"; newRegimeId: string; decision: "progress" | "rollback" };

interface Attempt {
  proposal: ProposedAdjustment;
  valid: boolean;
  feedback?: string;
}

async function attemptAdjustment(
  context: AdjustmentContext,
  riskTier: RiskTier,
  currentDraft: DraftRegime,
  userId: string,
  revisionFeedback?: string
): Promise<Attempt> {
  const proposal = await proposeAdjustment(context, revisionFeedback, { userId });

  const structural = validateStructure(proposal.regime);
  if (!structural.success) {
    return {
      proposal,
      valid: false,
      feedback: `Structural validation failed: ${JSON.stringify(structural.error.issues)}`,
    };
  }

  const clinical = validateRegime(proposal.regime, riskTier, currentDraft);
  if (!clinical.valid) {
    return { proposal, valid: false, feedback: clinical.issues.map((i) => i.message).join("; ") };
  }

  return { proposal, valid: true };
}

export async function runFlowBForUser(userId: string): Promise<FlowBResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const currentRegime = await prisma.regime.findFirstOrThrow({
    where: { userId, status: "ACTIVE" },
    include: { exerciseList: true },
  });

  const since = new Date();
  since.setDate(since.getDate() - TRAILING_WINDOW_DAYS);

  const logs = await prisma.sessionLog.findMany({
    where: { userId, loggedAt: { gte: since } },
    orderBy: { loggedAt: "desc" },
  });

  const currentDraft: DraftRegime = {
    exercises: currentRegime.exerciseList.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets ?? undefined,
      reps: e.reps ?? undefined,
      durationSeconds: e.durationSeconds ?? undefined,
      frequency: e.frequency ?? undefined,
      sessionSlot: e.sessionSlot,
    })),
  };

  const context: AdjustmentContext = {
    riskTier: user.riskTier,
    currentRegime: currentDraft,
    trailingSessionLogs: logs.map((log) => ({
      date: log.loggedAt.toISOString().slice(0, 10),
      painScore: log.painScore,
      madeItWorseFlag: log.flag,
    })),
  };

  let attempt = await attemptAdjustment(context, user.riskTier, currentDraft, userId);
  if (!attempt.valid) {
    attempt = await attemptAdjustment(context, user.riskTier, currentDraft, userId, attempt.feedback);
  }

  if (!attempt.valid) {
    await prisma.adjustmentEvent.create({
      data: {
        userId,
        fromRegimeVersionId: currentRegime.id,
        toRegimeVersionId: currentRegime.id,
        triggerType: "SCHEDULED_ADJUSTMENT",
        trailingWindowUsed: TRAILING_WINDOW_DAYS,
        rationale: `Held after 2 failed validateRegime attempts: ${attempt.feedback}`,
      },
    });
    return { status: "held", reason: `held after 2 failed validation attempts: ${attempt.feedback}` };
  }

  const { proposal } = attempt;

  if (proposal.decision === "hold") {
    await prisma.adjustmentEvent.create({
      data: {
        userId,
        fromRegimeVersionId: currentRegime.id,
        toRegimeVersionId: currentRegime.id,
        triggerType: "SCHEDULED_ADJUSTMENT",
        trailingWindowUsed: TRAILING_WINDOW_DAYS,
        rationale: proposal.rationale,
      },
    });
    return { status: "held", reason: proposal.rationale };
  }

  const newRegime = await prisma.$transaction(async (tx) => {
    await tx.regime.update({ where: { id: currentRegime.id }, data: { status: "SUPERSEDED" } });

    const created = await tx.regime.create({
      data: {
        userId,
        versionNumber: currentRegime.versionNumber + 1,
        createdBy: "AGENT",
        status: "ACTIVE",
        parentRegimeId: currentRegime.id,
        exerciseList: {
          create: proposal.regime.exercises.map((exercise, index) => ({
            exerciseId: exercise.exerciseId,
            sets: exercise.sets,
            reps: exercise.reps,
            durationSeconds: exercise.durationSeconds,
            frequency: exercise.frequency,
            sessionSlot: exercise.sessionSlot,
            orderIndex: index,
          })),
        },
      },
    });

    await tx.adjustmentEvent.create({
      data: {
        userId,
        fromRegimeVersionId: currentRegime.id,
        toRegimeVersionId: created.id,
        triggerType: "SCHEDULED_ADJUSTMENT",
        trailingWindowUsed: TRAILING_WINDOW_DAYS,
        rationale: proposal.rationale,
      },
    });

    return created;
  });

  return { status: "adjusted", newRegimeId: newRegime.id, decision: proposal.decision as "progress" | "rollback" };
}
