import { createClerkClient } from "@clerk/backend";

import { prisma } from "@rebound/db";

// One-off admin utility — deletes a user by email, same order/scope as the
// deleteMyAccount mutation (packages/api/src/routers/user.ts), for cases
// where the operator isn't signed in as that account. Uses deleteMany for
// the User row (not delete) since the account may never have completed
// onboarding and might have no app-data row at all.
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/delete-user-by-email.ts <email>");
    process.exit(1);
  }

  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email] });
  if (users.length > 1) {
    console.error(`Multiple Clerk users found for ${email} — aborting, resolve manually`);
    process.exit(1);
  }
  const [user] = users;
  if (!user) {
    console.error(`No Clerk user found for ${email}`);
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Found Clerk user ${userId} for ${email}`);

  const adjustmentEvents = await prisma.adjustmentEvent.deleteMany({ where: { userId } });
  const sessionLogs = await prisma.sessionLog.deleteMany({ where: { userId } });
  const workoutSessions = await prisma.workoutSession.deleteMany({ where: { userId } });
  const jobs = await prisma.regimeGenerationJob.deleteMany({ where: { userId } });
  const regimes = await prisma.regime.deleteMany({ where: { userId } });
  const appUsers = await prisma.user.deleteMany({ where: { id: userId } });

  console.log(
    `Deleted app data — adjustmentEvents: ${adjustmentEvents.count}, sessionLogs: ${sessionLogs.count}, workoutSessions: ${workoutSessions.count}, jobs: ${jobs.count}, regimes: ${regimes.count}, userRows: ${appUsers.count}`,
  );

  await clerkClient.users.deleteUser(userId);
  console.log(`Deleted Clerk identity for ${email} — the email is now free to sign up again.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
