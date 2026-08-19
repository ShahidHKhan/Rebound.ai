import { TRPCError } from "@trpc/server";
import { applyEscalationRollback } from "@rebound/agents";
import { checkEscalation } from "@rebound/clinical-rules";
import type { SessionLogEntry } from "@rebound/clinical-rules";
import { z } from "zod";

import { startOfToday } from "../date-utils";
import { protectedProcedure, router } from "../trpc";

export const sessionLogRouter = router({
  // History / trend screen: every SessionLog for this user, most recent
  // first. Scoped to ctx.userId; RLS (session_logs_isolation) also enforces
  // this at the DB layer.
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.sessionLog.findMany({
      where: { userId: ctx.userId },
      orderBy: { loggedAt: "desc" },
    });
  }),

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

      // Daily Session Structure: stat logging happens once daily. The
      // @@unique([userId, loggedAt]) constraint doesn't actually enforce
      // this (loggedAt defaults to the exact submission instant), so it has
      // to be checked explicitly here.
      const existingLogToday = await ctx.prisma.sessionLog.findFirst({
        where: { userId: ctx.userId, loggedAt: { gte: startOfToday() } },
      });
      if (existingLogToday) {
        throw new TRPCError({ code: "CONFLICT", message: "You've already logged today." });
      }

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
