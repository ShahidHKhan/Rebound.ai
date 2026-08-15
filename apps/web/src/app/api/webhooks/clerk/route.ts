import { Webhook } from "svix";
import { NextResponse } from "next/server";

import { prisma } from "@rebound/db";

// Safety net for account deletions initiated from Clerk's own side (Clerk
// dashboard, or a future self-service Clerk user portal) rather than through
// our deleteMyAccount mutation (packages/api/src/routers/user.ts). Runs on
// the privileged `prisma` connection like the cron routes — there's no
// authenticated request/RLS session here, just Clerk telling us a user is
// already gone. Deletion order matches deleteMyAccount and
// packages/api/scripts/setup-day4-test-users.ts.
async function deleteUserData(userId: string) {
  await prisma.adjustmentEvent.deleteMany({ where: { userId } });
  await prisma.sessionLog.deleteMany({ where: { userId } });
  await prisma.workoutSession.deleteMany({ where: { userId } });
  await prisma.regimeGenerationJob.deleteMany({ where: { userId } });
  await prisma.regime.deleteMany({ where: { userId } });
  // Our own deleteMyAccount already removed the User row (and the Clerk
  // user) in the common case, so this webhook usually finds nothing left —
  // that's fine, deleteMany/delete-if-exists below are no-ops then.
  await prisma.user.deleteMany({ where: { id: userId } });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set — rejecting webhook");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  let event: { type: string; data: { id: string } };
  try {
    event = new Webhook(webhookSecret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: { id: string } };
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "user.deleted") {
    await deleteUserData(event.data.id);
  }

  return NextResponse.json({ received: true });
}
