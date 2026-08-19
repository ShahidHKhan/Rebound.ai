import { createClerkClient } from "@clerk/backend";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Same bounds onboardingSubmissionSchema uses for these two fields
// (packages/api/src/schemas.ts) — minutes since local midnight, 0-1439.
const notificationTimesSchema = z.object({
  wakeTimeMinutes: z.number().int().min(0).max(1439),
  eveningTimeMinutes: z.number().int().min(0).max(1439),
});

export const userRouter = router({
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
