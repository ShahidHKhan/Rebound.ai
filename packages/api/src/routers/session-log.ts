import { applyEscalationRollback } from "@rebound/agents";
import { checkEscalation } from "@rebound/clinical-rules";
import type { SessionLogEntry } from "@rebound/clinical-rules";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

export const sessionLogRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        painScore: z.number().int().min(0).max(10),
        flag: z.boolean().default(false),
        perceivedExertion: z.number().int().min(0).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const activeRegime = await ctx.prisma.regime.findFirstOrThrow({
        where: { userId: ctx.userId, status: "ACTIVE" },
      });

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });

      const log = await ctx.prisma.sessionLog.create({
        data: {
          userId: ctx.userId,
          regimeVersionId: activeRegime.id,
          painScore: input.painScore,
          flag: input.flag,
          perceivedExertion: input.perceivedExertion,
        },
      });

      // Real-time escalation monitor — runs inline on every write, decoupled
      // from Flow B's cadence (Clinical Risk Framing > Escalation monitor).
      const recentLogs = await ctx.prisma.sessionLog.findMany({
        where: { userId: ctx.userId },
        orderBy: { loggedAt: "desc" },
        take: 3,
      });

      const entries: SessionLogEntry[] = recentLogs.map((l) => ({
        date: l.loggedAt.toISOString().slice(0, 10),
        painScore: l.painScore,
        madeItWorseFlag: l.flag,
      }));

      const escalation = checkEscalation(entries, user.riskTier);

      // Admin panel > Manual override: both the escalation monitor and Flow B
      // must skip automated action for a manually-held user. Flow B's cron
      // route already filters manualHold users out at the query level; this
      // was the one call site where that check was missing.
      if (escalation.action === "rollback" && !user.manualHold) {
        await applyEscalationRollback(
          ctx.userId,
          activeRegime.id,
          activeRegime.parentRegimeId,
          escalation,
          entries.length
        );
      }

      return { sessionLogId: log.id, escalation };
    }),
});
