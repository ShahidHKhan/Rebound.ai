import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AVAILABLE_MODELS, diffRegimes, runFlowATestRun, runFlowBTestRun, runScenarioFlowBCycle } from "@rebound/agents";
import type { RegimeDiffEntry } from "@rebound/agents";
import type { DraftRegime } from "@rebound/clinical-rules";

import { adjustmentFixtureSchema, onboardingSubmissionSchema } from "../schemas";
import { adminOnlyProcedure, router } from "../trpc";

function isValidModel(model: string): boolean {
  return AVAILABLE_MODELS.some((m) => m.id === model);
}

// A TestRun's resultJson carries the regime under `draft` (Flow A) or
// `regime` (Flow B) depending on flow — this normalizes either shape for
// diffRegimes, returning null if the run has no regime yet (RUNNING/ERROR).
function extractRegimeFromResult(resultJson: unknown): DraftRegime | null {
  const parsed = resultJson as { draft?: DraftRegime; regime?: DraftRegime } | null;
  return parsed?.draft ?? parsed?.regime ?? null;
}

function diffIfPossible(beforeResultJson: unknown, afterResultJson: unknown): RegimeDiffEntry[] | null {
  const before = extractRegimeFromResult(beforeResultJson);
  const after = extractRegimeFromResult(afterResultJson);
  return before && after ? diffRegimes(before, after) : null;
}

// Groups the LLM-call trace and totals a TestRun's cost — shared by every
// procedure below that returns a full run.
const testRunInclude = { llmCalls: { orderBy: { sequenceIndex: "asc" as const } }, fixture: true };

// A TestRun's resultJson only carries exerciseIds (that's what the LLM/
// validator actually work with) — this hydrates real names/categories for
// display, without ever storing them denormalized on the row itself.
async function hydrateExerciseNames(prisma: { exercise: { findMany: Function } }, resultJson: unknown) {
  const draft = (resultJson as { draft?: { exercises?: { exerciseId: string }[] }; regime?: { exercises?: { exerciseId: string }[] } })
    ?.draft ?? (resultJson as { regime?: { exercises?: { exerciseId: string }[] } })?.regime;
  const ids = draft?.exercises?.map((e) => e.exerciseId) ?? [];
  if (ids.length === 0) return {};

  const exercises = (await prisma.exercise.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, category: true },
  })) as { id: string; name: string; category: string }[];

  return Object.fromEntries(exercises.map((e) => [e.id, { name: e.name, category: e.category }]));
}

export const adminExperimentsRouter = router({
  availableModels: adminOnlyProcedure.query(() => AVAILABLE_MODELS),

  fixtures: router({
    list: adminOnlyProcedure
      .input(z.object({ type: z.enum(["ONBOARDING", "ADJUSTMENT"]).optional() }).optional())
      .query(({ ctx, input }) =>
        ctx.prisma.testFixture.findMany({
          where: input?.type ? { type: input.type } : undefined,
          orderBy: { createdAt: "desc" },
        })
      ),

    create: adminOnlyProcedure
      .input(
        z.object({
          name: z.string().min(1).max(200),
          description: z.string().max(500).optional(),
          type: z.enum(["ONBOARDING", "ADJUSTMENT"]),
          payload: z.unknown(),
        })
      )
      .mutation(({ ctx, input }) => {
        // Catch a malformed fixture at creation time, not at run time —
        // reuses the exact schema real onboarding.submit validates against.
        const parsed =
          input.type === "ONBOARDING"
            ? onboardingSubmissionSchema.safeParse(input.payload)
            : adjustmentFixtureSchema.safeParse(input.payload);

        if (!parsed.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payload doesn't match the ${input.type} shape: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
          });
        }

        return ctx.prisma.testFixture.create({
          data: { name: input.name, description: input.description, type: input.type, payload: parsed.data },
        });
      }),

    delete: adminOnlyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const runCount = await ctx.prisma.testRun.count({ where: { fixtureId: input.id } });
      if (runCount > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can't delete — ${runCount} test run(s) reference this fixture.`,
        });
      }
      await ctx.prisma.testFixture.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
  }),

  testRuns: router({
    trigger: adminOnlyProcedure
      .input(z.object({ fixtureId: z.string(), model: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidModel(input.model)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown model: ${input.model}` });
        }

        const fixture = await ctx.prisma.testFixture.findUnique({ where: { id: input.fixtureId } });
        if (!fixture) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fixture not found." });
        }

        const { testRunId } =
          fixture.type === "ONBOARDING"
            ? await runFlowATestRun(fixture, input.model, ctx.userId)
            : await runFlowBTestRun(fixture, input.model, ctx.userId);

        const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: testRunId }, include: testRunInclude });
        const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);
        return { ...testRun, exerciseNames };
      }),

    list: adminOnlyProcedure.query(({ ctx }) =>
      ctx.prisma.testRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { fixture: { select: { name: true } }, llmCalls: { select: { costUsd: true } } },
      })
    ),

    getById: adminOnlyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: input.id }, include: testRunInclude });
      const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);
      return { ...testRun, exerciseNames };
    }),
  }),

  llmCalls: router({
    list: adminOnlyProcedure
      .input(
        z.object({
          flow: z.enum(["FLOW_A_DRAFT", "FLOW_B_ADJUST", "FREE_TEXT_CLASSIFIER"]).optional(),
          source: z.enum(["PRODUCTION", "ADMIN_TEST"]).optional(),
          model: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
      )
      .query(({ ctx, input }) =>
        ctx.prisma.llmCall.findMany({
          where: { flow: input.flow, source: input.source, model: input.model },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        })
      ),
  }),

  scenarios: router({
    start: adminOnlyProcedure
      .input(
        z.object({
          fixtureId: z.string(),
          model: z.string(),
          name: z.string().min(1).max(200),
          description: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isValidModel(input.model)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown model: ${input.model}` });
        }

        const fixture = await ctx.prisma.testFixture.findUnique({ where: { id: input.fixtureId } });
        if (!fixture) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fixture not found." });
        }
        if (fixture.type !== "ONBOARDING") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A scenario must start from an ONBOARDING fixture." });
        }

        const scenario = await ctx.prisma.scenario.create({
          data: { name: input.name, description: input.description, createdByUserId: ctx.userId },
        });

        const { testRunId } = await runFlowATestRun(fixture, input.model, ctx.userId, { scenarioId: scenario.id });
        const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: testRunId }, include: testRunInclude });
        const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);

        return { scenario, testRun: { ...testRun, exerciseNames } };
      }),

    runNextCycle: adminOnlyProcedure
      .input(
        z.object({
          scenarioId: z.string(),
          painPattern: z.enum(["IMPROVING", "PLATEAUING", "WORSENING", "CONTRADICTORY"]),
          days: z.number().int().min(3).max(21).default(7),
          model: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isValidModel(input.model)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown model: ${input.model}` });
        }

        const scenario = await ctx.prisma.scenario.findUnique({ where: { id: input.scenarioId } });
        if (!scenario) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found." });
        }

        const previousTestRun = await ctx.prisma.testRun.findFirst({
          where: { scenarioId: scenario.id },
          orderBy: { cycleIndex: "desc" },
        });
        if (!previousTestRun) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Scenario has no cycles yet." });
        }
        if (previousTestRun.status !== "VALID") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Can't continue from a ${previousTestRun.status} cycle — the previous regime isn't valid.`,
          });
        }

        const { testRunId } = await runScenarioFlowBCycle(
          scenario,
          previousTestRun,
          input.painPattern,
          input.days,
          input.model,
          ctx.userId
        );
        const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: testRunId }, include: testRunInclude });
        const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);

        const cycleZero =
          previousTestRun.cycleIndex === 0
            ? previousTestRun
            : await ctx.prisma.testRun.findFirst({ where: { scenarioId: scenario.id, cycleIndex: 0 } });

        return {
          ...testRun,
          exerciseNames,
          diffFromPrevious: diffIfPossible(previousTestRun.resultJson, testRun.resultJson),
          diffFromOriginal: cycleZero ? diffIfPossible(cycleZero.resultJson, testRun.resultJson) : null,
        };
      }),

    list: adminOnlyProcedure.query(async ({ ctx }) => {
      const scenarios = await ctx.prisma.scenario.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          testRuns: {
            select: { cycleIndex: true, status: true, llmCalls: { select: { costUsd: true } } },
            orderBy: { cycleIndex: "desc" },
          },
        },
      });

      return scenarios.map((scenario) => {
        const totalCost = scenario.testRuns
          .flatMap((run) => run.llmCalls)
          .reduce((sum, call) => sum + (call.costUsd ? Number(call.costUsd) : 0), 0);
        const latest = scenario.testRuns[0];

        return {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          createdAt: scenario.createdAt,
          cycleCount: scenario.testRuns.length,
          latestStatus: latest?.status ?? null,
          totalCost,
        };
      });
    }),

    getById: adminOnlyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const scenario = await ctx.prisma.scenario.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          testRuns: {
            orderBy: { cycleIndex: "asc" },
            include: { llmCalls: { orderBy: { sequenceIndex: "asc" } } },
          },
        },
      });

      const cycleZero = scenario.testRuns.find((run) => run.cycleIndex === 0) ?? null;
      let previous: (typeof scenario.testRuns)[number] | null = null;

      const cycles = [];
      for (const run of scenario.testRuns) {
        const exerciseNames = await hydrateExerciseNames(ctx.prisma, run.resultJson);
        cycles.push({
          ...run,
          exerciseNames,
          diffFromPrevious: previous ? diffIfPossible(previous.resultJson, run.resultJson) : null,
          diffFromOriginal:
            cycleZero && run.cycleIndex !== 0 ? diffIfPossible(cycleZero.resultJson, run.resultJson) : null,
        });
        previous = run;
      }

      // Flattens every cycle's synthetic trailing logs into one chronological
      // "simulated day" timeline — cycles are generated moments apart in real
      // wall-clock time, so their raw calendar dates overlap; a simple
      // incrementing counter per cycle's chronological logs is what the pain
      // chart actually needs, not the real dates.
      let simulatedDay = 0;
      const painTimeline: Array<{ simulatedDay: number; painScore: number; madeItWorseFlag: boolean; cycleIndex: number }> = [];
      for (const run of scenario.testRuns) {
        if (run.cycleIndex === 0) continue;
        const runInput = run.inputJson as { trailingSessionLogs?: Array<{ painScore: number; madeItWorseFlag: boolean }> } | null;
        const chronological = [...(runInput?.trailingSessionLogs ?? [])].reverse();
        for (const log of chronological) {
          simulatedDay++;
          painTimeline.push({
            simulatedDay,
            painScore: log.painScore,
            madeItWorseFlag: log.madeItWorseFlag,
            cycleIndex: run.cycleIndex!,
          });
        }
      }

      return { scenario: { id: scenario.id, name: scenario.name, description: scenario.description, createdAt: scenario.createdAt }, cycles, painTimeline };
    }),

    delete: adminOnlyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ctx.prisma.scenario.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
  }),
});
