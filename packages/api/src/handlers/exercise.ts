import type { ExerciseMedia, ExerciseResponse } from "@rebound/contracts";

import type { Prisma } from "@rebound/db";

type Ctx = { prisma: Prisma.TransactionClient; userId: string };

// Exercise is shared library content (Free Exercise DB), not user-owned data
// — same category as Preset, deliberately excluded from RLS policies
// (packages/db/sql/rls-policies.sql). No ownership check needed here, just
// a straight fetch by id — mirrors packages/api/src/routers/exercise.ts
// exactly.
export async function getExerciseById(ctx: Ctx, input: { exerciseId: string }): Promise<ExerciseResponse> {
  const exercise = await ctx.prisma.exercise.findUniqueOrThrow({ where: { id: input.exerciseId } });

  return {
    ...exercise,
    // Prisma's Json? column type-checks broader than the real shape stored
    // here — see packages/contracts/src/schemas/exercise.ts for why the
    // response schema narrows it instead of widening to "any object".
    media: exercise.media as ExerciseMedia,
  };
}
