import { createClerkClient } from "@clerk/backend";

import { prisma } from "@rebound/db";

// One-off admin utility — promotes/demotes a user's role by email, same
// lookup pattern as delete-user-by-email.ts. Needed because User.role is
// the only thing adminProcedure/adminOnlyProcedure check (packages/api/src/trpc.ts)
// and there was no existing way to set it outside a raw DB edit.
async function main() {
  const email = process.argv[2];
  const role = process.argv[3];

  if (!email || (role !== "ADMIN" && role !== "USER")) {
    console.error("Usage: tsx scripts/set-user-role.ts <email> <ADMIN|USER>");
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  console.log(`${email} (${user.id}) is now role: ${updated.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
