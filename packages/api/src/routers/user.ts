import { createClerkClient } from "@clerk/backend";

import { protectedProcedure, router } from "../trpc";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export const userRouter = router({
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
