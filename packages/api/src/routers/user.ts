import { createClerkClient } from "@clerk/backend";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Matches the PRD's Business Model cancellation-flow reason codes exactly.
const cancellationReasonCodeSchema = z.enum([
  "TOO_EXPENSIVE",
  "NOT_SEEING_RESULTS",
  "PLAN_TOO_DEMANDING",
  "PLAN_TOO_EASY",
  "TECHNICAL_ISSUES",
  "OTHER",
]);

// Same bounds onboardingSubmissionSchema uses for these two fields
// (packages/api/src/schemas.ts) — minutes since local midnight, 0-1439.
const notificationTimesSchema = z.object({
  wakeTimeMinutes: z.number().int().min(0).max(1439),
  eveningTimeMinutes: z.number().int().min(0).max(1439),
});

export const userRouter = router({
  // Profile + Billing screens' data in one round trip. Identity (name/email)
  // deliberately excluded — Clerk's own useUser() owns that on both
  // frontends, no name field was added to the User model for it.
  getMe: protectedProcedure.query(async ({ ctx }) => {
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
      ...user,
      billing: {
        trialActive: firstScheduledAdjustment === null,
        firstAdjustmentAt: firstScheduledAdjustment?.triggeredAt ?? null,
      },
    };
  }),

  // Cancellation-flow stub (Business Model: "capture a reason code at
  // cancel time"). No real subscription exists to cancel during the beta
  // (no Stripe integration anywhere in the repo yet) — this validates and
  // records the reason server-side only, it never cancels anything. Not
  // persisted to the DB: no schema change was made for this stub (see
  // HANDOFF.md's live-Supabase-DB caution), so this is a placeholder for
  // real churn-reason wiring once billing exists rather than a permanent
  // record today.
  submitCancellationFeedback: protectedProcedure
    .input(z.object({ reasonCode: cancellationReasonCodeSchema, comment: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      console.log(
        `[cancellation feedback, beta preview] user=${ctx.userId} reason=${input.reasonCode}${
          input.comment ? ` comment=${input.comment}` : ""
        }`
      );
      return { received: true as const };
    }),

  // Notification settings screen: the morning wake time / evening session
  // time were previously set once at onboarding with no way to revisit them.
  getNotificationTimes: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { wakeTimeMinutes: true, eveningTimeMinutes: true },
    });
    return user;
  }),

  // Doesn't retroactively move already-created WorkoutSession rows for
  // today (regime.activate only ever writes scheduledAt once, see
  // HANDOFF's known gap) — takes effect for the next time a schedule is
  // computed. Mobile re-syncs its local notifications after this succeeds
  // (see apps/mobile's notification-settings screen).
  updateNotificationTimes: protectedProcedure.input(notificationTimesSchema).mutation(async ({ ctx, input }) => {
    const updated = await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: {
        wakeTimeMinutes: input.wakeTimeMinutes,
        eveningTimeMinutes: input.eveningTimeMinutes,
      },
      select: { wakeTimeMinutes: true, eveningTimeMinutes: true },
    });
    return updated;
  }),

  // Self-service account + data deletion. Deletes in dependency order
  // (matches the reset order packages/api/scripts/setup-day4-test-users.ts
  // already used) since none of these FKs cascade at the DB level; Regime
  // and WorkoutSession do cascade their own child rows
  // (RegimeExercise/WorkoutSessionExercise). Runs on ctx.prisma directly,
  // not a nested $transaction — protectedProcedure already wraps every
  // request in one (see trpc.ts / regime.activate's flattening note).
  deleteMyAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx;

    await ctx.prisma.adjustmentEvent.deleteMany({ where: { userId } });
    await ctx.prisma.sessionLog.deleteMany({ where: { userId } });
    await ctx.prisma.workoutSession.deleteMany({ where: { userId } });
    await ctx.prisma.regimeGenerationJob.deleteMany({ where: { userId } });
    await ctx.prisma.regime.deleteMany({ where: { userId } });
    await ctx.prisma.user.delete({ where: { id: userId } });

    // Removes the Clerk identity itself so the account can't sign back in
    // as an orphan with no app data. Best-effort: app data is already gone
    // by this point regardless of whether this call succeeds, and the
    // user.deleted webhook (apps/web/src/app/api/webhooks/clerk/route.ts)
    // is a safety net for deletions initiated from Clerk's own side.
    try {
      await clerkClient.users.deleteUser(userId);
    } catch (error) {
      console.error(`Failed to delete Clerk user ${userId} after app-data deletion:`, error);
    }

    return { success: true as const };
  }),
});
