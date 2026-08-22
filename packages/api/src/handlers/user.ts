import { createClerkClient } from "@clerk/backend";

import type {
  CancellationReasonCode,
  DeleteMyAccountResponse,
  GetMeResponse,
  NotificationTimesResponse,
  SubmitCancellationFeedbackResponse,
  UpdateNotificationTimesInput,
} from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Profile + Billing screens' data in one round trip. Identity (name/email)
// deliberately excluded — Clerk's own useUser()/useAuth() owns that on both
// frontends, no name field was added to the User model for it. Mirrors
// packages/api/src/routers/user.ts's getMe exactly.
export async function getMe(ctx: Ctx): Promise<GetMeResponse> {
  const [user, firstScheduledAdjustment] = await Promise.all([
    ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { goalType: true, createdAt: true, wakeTimeMinutes: true, eveningTimeMinutes: true },
    }),
    // Business Model: "the paywall triggers at the first recursive regime
    // adjustment" — deliberately SCHEDULED_ADJUSTMENT only. An
    // ESCALATION_ROLLBACK is a safety guardrail firing, not the product
    // completing a normal cycle, so it must never start a billing clock.
    ctx.prisma.adjustmentEvent.findFirst({
      where: { userId: ctx.userId, triggerType: "SCHEDULED_ADJUSTMENT" },
      orderBy: { triggeredAt: "asc" },
      select: { triggeredAt: true },
    }),
  ]);

  return {
    goalType: user.goalType,
    createdAt: user.createdAt.toISOString(),
    wakeTimeMinutes: user.wakeTimeMinutes,
    eveningTimeMinutes: user.eveningTimeMinutes,
    billing: {
      trialActive: firstScheduledAdjustment === null,
      firstAdjustmentAt: firstScheduledAdjustment?.triggeredAt.toISOString() ?? null,
    },
  };
}

// Cancellation-flow stub (Business Model: "capture a reason code at cancel
// time"). No real subscription exists to cancel during the beta — this
// validates and records the reason server-side only, it never cancels
// anything. Not persisted to the DB, matching the tRPC version.
export async function submitCancellationFeedback(
  ctx: Ctx,
  input: { reasonCode: CancellationReasonCode; comment?: string }
): Promise<SubmitCancellationFeedbackResponse> {
  console.log(
    `[cancellation feedback, beta preview] user=${ctx.userId} reason=${input.reasonCode}${
      input.comment ? ` comment=${input.comment}` : ""
    }`
  );
  return { received: true as const };
}

export async function getNotificationTimes(ctx: Ctx): Promise<NotificationTimesResponse> {
  return ctx.prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { wakeTimeMinutes: true, eveningTimeMinutes: true },
  });
}

// Doesn't retroactively move already-created WorkoutSession rows for today
// (regime.activate only ever writes scheduledAt once) — takes effect for
// the next time a schedule is computed. Mobile re-syncs its local
// notifications after this succeeds.
export async function updateNotificationTimes(
  ctx: Ctx,
  input: UpdateNotificationTimesInput
): Promise<NotificationTimesResponse> {
  return ctx.prisma.user.update({
    where: { id: ctx.userId },
    data: { wakeTimeMinutes: input.wakeTimeMinutes, eveningTimeMinutes: input.eveningTimeMinutes },
    select: { wakeTimeMinutes: true, eveningTimeMinutes: true },
  });
}

// Self-service account + data deletion. Deletes in dependency order (Regime
// and WorkoutSession cascade their own child rows; the rest don't cascade
// at the DB level) — mirrors packages/api/src/routers/user.ts exactly, do
// not reorder without re-checking FK constraints.
export async function deleteMyAccount(ctx: Ctx): Promise<DeleteMyAccountResponse> {
  const { userId } = ctx;

  await ctx.prisma.adjustmentEvent.deleteMany({ where: { userId } });
  await ctx.prisma.sessionLog.deleteMany({ where: { userId } });
  await ctx.prisma.workoutSession.deleteMany({ where: { userId } });
  await ctx.prisma.regimeGenerationJob.deleteMany({ where: { userId } });
  await ctx.prisma.regime.deleteMany({ where: { userId } });
  await ctx.prisma.user.delete({ where: { id: userId } });

  // Removes the Clerk identity itself so the account can't sign back in as
  // an orphan with no app data. Best-effort: app data is already gone by
  // this point regardless of whether this call succeeds, and the
  // user.deleted webhook (apps/web/src/app/api/webhooks/clerk/route.ts) is
  // a safety net for deletions initiated from Clerk's own side.
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (error) {
    console.error(`Failed to delete Clerk user ${userId} after app-data deletion:`, error);
  }

  return { success: true as const };
}
