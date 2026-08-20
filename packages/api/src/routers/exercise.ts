import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

// Exercise is shared library content (Free Exercise DB), not user-owned data
// — same category as Preset, deliberately excluded from RLS policies
// (packages/db/sql/rls-policies.sql). No ownership check needed here, just
// a straight fetch by id, matching regime.getById's IDOR-safe pattern minus
// the ownership check that doesn't apply to shared content.
export const exerciseRouter = router({
  getById: protectedProcedure.input(z.object({ exerciseId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.prisma.exercise.findUniqueOrThrow({ where: { id: input.exerciseId } });
  }),
});
