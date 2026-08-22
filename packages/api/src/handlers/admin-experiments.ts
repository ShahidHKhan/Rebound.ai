import { AVAILABLE_MODELS, diffRegimes, runFlowATestRun, runFlowBTestRun, runScenarioFlowBCycle } from "@rebound/agents";
import type { RegimeDiffEntry } from "@rebound/agents";
import type { DraftRegime } from "@rebound/clinical-rules";

import type {
  CreateTestFixtureInput,
  DeleteByIdResponse,
  LlmCallResponse,
  ListLlmCallsInput,
  RunNextCycleInput,
  ScenarioCycleResponse,
  StartScenarioInput,
  TestFixtureResponse,
  TestRunDetailResponse,
  TriggerTestRunInput,
} from "@rebound/contracts";

import type { Prisma, UnscopedPrismaClient } from "@rebound/db";

import { adjustmentFixtureSchema, onboardingSubmissionSchema } from "../schemas";
import { ApiError } from "../errors";

// UnscopedPrismaClient, not PrismaClient: these handlers run behind
// withAdminOnlyAuth, which is the one authenticated path with no RLS
// transaction behind it. The narrowed type means reaching for a user-owned
// table here fails to compile. See prismaUnscoped in packages/db/src/index.ts.
type Ctx = { prisma: UnscopedPrismaClient; userId: string };

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
// handler below that returns a full run.
const testRunInclude = { llmCalls: { orderBy: { sequenceIndex: "asc" as const } }, fixture: true };

// A TestRun's resultJson only carries exerciseIds — hydrates real
// names/categories for display, without ever storing them denormalized.
async function hydrateExerciseNames(
  prisma: UnscopedPrismaClient,
  resultJson: unknown
): Promise<Record<string, { name: string; category: string }>> {
  const draft =
    (resultJson as { draft?: { exercises?: { exerciseId: string }[] }; regime?: { exercises?: { exerciseId: string }[] } })
      ?.draft ?? (resultJson as { regime?: { exercises?: { exerciseId: string }[] } })?.regime;
  const ids = draft?.exercises?.map((e) => e.exerciseId) ?? [];
  if (ids.length === 0) return {};

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, category: true },
  });

  return Object.fromEntries(exercises.map((e) => [e.id, { name: e.name, category: e.category }]));
}

function toTestFixtureResponse(f: {
  id: string;
  name: string;
  description: string | null;
  type: "ONBOARDING" | "ADJUSTMENT";
  payload: unknown;
  createdAt: Date;
}): TestFixtureResponse {
  return { ...f, createdAt: f.createdAt.toISOString() };
}

function toLlmCallResponse(c: {
  id: string;
  createdAt: Date;
  flow: "FLOW_A_DRAFT" | "FLOW_B_ADJUST" | "FREE_TEXT_CLASSIFIER";
  source: "PRODUCTION" | "ADMIN_TEST";
  model: string;
  groupId: string;
  sequenceIndex: number;
  userId: string | null;
  testRunId: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: Prisma.Decimal | null;
  stopReason: string | null;
  success: boolean;
  errorMessage: string | null;
  requestJson: unknown;
  responseJson: unknown;
}): LlmCallResponse {
  return { ...c, createdAt: c.createdAt.toISOString(), costUsd: c.costUsd?.toString() ?? null };
}

type TestRunDetailRow = Prisma.TestRunGetPayload<{ include: typeof testRunInclude }>;

function toTestRunDetailResponse(
  run: TestRunDetailRow,
  exerciseNames: Record<string, { name: string; category: string }>
): TestRunDetailResponse {
  return {
    id: run.id,
    fixtureId: run.fixtureId,
    flow: run.flow,
    model: run.model,
    status: run.status,
    resultJson: run.resultJson,
    createdByUserId: run.createdByUserId,
    createdAt: run.createdAt.toISOString(),
    scenarioId: run.scenarioId,
    cycleIndex: run.cycleIndex,
    inputJson: run.inputJson,
    llmCalls: run.llmCalls.map(toLlmCallResponse),
    fixture: run.fixture ? toTestFixtureResponse(run.fixture) : null,
    exerciseNames,
  };
}

// --- models ---

export async function getAvailableModels() {
  return [...AVAILABLE_MODELS];
}

// --- fixtures ---

export async function listFixtures(ctx: Ctx, input: { type?: "ONBOARDING" | "ADJUSTMENT" }): Promise<TestFixtureResponse[]> {
  const fixtures = await ctx.prisma.testFixture.findMany({
    where: input.type ? { type: input.type } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return fixtures.map(toTestFixtureResponse);
}

// Catches a malformed fixture at creation time, not at run time — reuses
// the exact schema real onboarding.submit validates against.
export async function createFixture(ctx: Ctx, input: CreateTestFixtureInput): Promise<TestFixtureResponse> {
  const parsed =
    input.type === "ONBOARDING"
      ? onboardingSubmissionSchema.safeParse(input.payload)
      : adjustmentFixtureSchema.safeParse(input.payload);

  if (!parsed.success) {
    throw new ApiError(
      "BAD_REQUEST",
      `Payload doesn't match the ${input.type} shape: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }

  const fixture = await ctx.prisma.testFixture.create({
    data: { name: input.name, description: input.description, type: input.type, payload: parsed.data },
  });
  return toTestFixtureResponse(fixture);
}

export async function deleteFixture(ctx: Ctx, input: { id: string }): Promise<DeleteByIdResponse> {
  const runCount = await ctx.prisma.testRun.count({ where: { fixtureId: input.id } });
  if (runCount > 0) {
    throw new ApiError("BAD_REQUEST", `Can't delete — ${runCount} test run(s) reference this fixture.`);
  }
  await ctx.prisma.testFixture.delete({ where: { id: input.id } });
  return { id: input.id };
}

// --- test runs ---

export async function triggerTestRun(ctx: Ctx, input: TriggerTestRunInput): Promise<TestRunDetailResponse> {
  if (!isValidModel(input.model)) {
    throw new ApiError("BAD_REQUEST", `Unknown model: ${input.model}`);
  }

  const fixture = await ctx.prisma.testFixture.findUnique({ where: { id: input.fixtureId } });
  if (!fixture) {
    throw new ApiError("NOT_FOUND", "Fixture not found.");
  }

  const { testRunId } =
    fixture.type === "ONBOARDING"
      ? await runFlowATestRun(fixture, input.model, ctx.userId)
      : await runFlowBTestRun(fixture, input.model, ctx.userId);

  const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: testRunId }, include: testRunInclude });
  const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);
  return toTestRunDetailResponse(testRun, exerciseNames);
}

export async function listTestRuns(ctx: Ctx) {
  const runs = await ctx.prisma.testRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { fixture: { select: { name: true } }, llmCalls: { select: { costUsd: true } } },
  });

  return runs.map((run) => ({
    id: run.id,
    fixtureId: run.fixtureId,
    flow: run.flow,
    model: run.model,
    status: run.status,
    resultJson: run.resultJson,
    createdByUserId: run.createdByUserId,
    createdAt: run.createdAt.toISOString(),
    scenarioId: run.scenarioId,
    cycleIndex: run.cycleIndex,
    inputJson: run.inputJson,
    fixture: run.fixture,
    llmCalls: run.llmCalls.map((c) => ({ costUsd: c.costUsd?.toString() ?? null })),
  }));
}

export async function getTestRunById(ctx: Ctx, input: { id: string }): Promise<TestRunDetailResponse> {
  const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: input.id }, include: testRunInclude });
  const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);
  return toTestRunDetailResponse(testRun, exerciseNames);
}

// --- LLM calls ---

export async function listLlmCalls(ctx: Ctx, input: ListLlmCallsInput): Promise<LlmCallResponse[]> {
  const calls = await ctx.prisma.llmCall.findMany({
    where: { flow: input.flow, source: input.source, model: input.model },
    orderBy: { createdAt: "desc" },
    take: input.limit,
  });
  return calls.map(toLlmCallResponse);
}

// --- scenarios ---

export async function startScenario(ctx: Ctx, input: StartScenarioInput) {
  if (!isValidModel(input.model)) {
    throw new ApiError("BAD_REQUEST", `Unknown model: ${input.model}`);
  }

  const fixture = await ctx.prisma.testFixture.findUnique({ where: { id: input.fixtureId } });
  if (!fixture) {
    throw new ApiError("NOT_FOUND", "Fixture not found.");
  }
  if (fixture.type !== "ONBOARDING") {
    throw new ApiError("BAD_REQUEST", "A scenario must start from an ONBOARDING fixture.");
  }

  const scenario = await ctx.prisma.scenario.create({
    data: { name: input.name, description: input.description, createdByUserId: ctx.userId },
  });

  const { testRunId } = await runFlowATestRun(fixture, input.model, ctx.userId, { scenarioId: scenario.id });
  const testRun = await ctx.prisma.testRun.findUniqueOrThrow({ where: { id: testRunId }, include: testRunInclude });
  const exerciseNames = await hydrateExerciseNames(ctx.prisma, testRun.resultJson);

  return {
    scenario: { ...scenario, createdAt: scenario.createdAt.toISOString() },
    testRun: toTestRunDetailResponse(testRun, exerciseNames),
  };
}

export async function runNextCycle(
  ctx: Ctx,
  input: { scenarioId: string } & RunNextCycleInput
): Promise<ScenarioCycleResponse> {
  if (!isValidModel(input.model)) {
    throw new ApiError("BAD_REQUEST", `Unknown model: ${input.model}`);
  }

  const scenario = await ctx.prisma.scenario.findUnique({ where: { id: input.scenarioId } });
  if (!scenario) {
    throw new ApiError("NOT_FOUND", "Scenario not found.");
  }

  const previousTestRun = await ctx.prisma.testRun.findFirst({
    where: { scenarioId: scenario.id },
    orderBy: { cycleIndex: "desc" },
  });
  if (!previousTestRun) {
    throw new ApiError("BAD_REQUEST", "Scenario has no cycles yet.");
  }
  if (previousTestRun.status !== "VALID") {
    throw new ApiError("BAD_REQUEST", `Can't continue from a ${previousTestRun.status} cycle — the previous regime isn't valid.`);
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
    ...toTestRunDetailResponse(testRun, exerciseNames),
    diffFromPrevious: diffIfPossible(previousTestRun.resultJson, testRun.resultJson),
    diffFromOriginal: cycleZero ? diffIfPossible(cycleZero.resultJson, testRun.resultJson) : null,
  };
}

export async function listScenarios(ctx: Ctx) {
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
      createdAt: scenario.createdAt.toISOString(),
      cycleCount: scenario.testRuns.length,
      latestStatus: latest?.status ?? null,
      totalCost,
    };
  });
}

export async function getScenarioById(ctx: Ctx, input: { id: string }) {
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

  const cycles: ScenarioCycleResponse[] = [];
  for (const run of scenario.testRuns) {
    const exerciseNames = await hydrateExerciseNames(ctx.prisma, run.resultJson);
    cycles.push({
      id: run.id,
      fixtureId: run.fixtureId,
      flow: run.flow,
      model: run.model,
      status: run.status,
      resultJson: run.resultJson,
      createdByUserId: run.createdByUserId,
      createdAt: run.createdAt.toISOString(),
      scenarioId: run.scenarioId,
      cycleIndex: run.cycleIndex,
      inputJson: run.inputJson,
      llmCalls: run.llmCalls.map(toLlmCallResponse),
      fixture: null,
      exerciseNames,
      diffFromPrevious: previous ? diffIfPossible(previous.resultJson, run.resultJson) : null,
      diffFromOriginal: cycleZero && run.cycleIndex !== 0 ? diffIfPossible(cycleZero.resultJson, run.resultJson) : null,
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

  return {
    scenario: {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      createdAt: scenario.createdAt.toISOString(),
    },
    cycles,
    painTimeline,
  };
}

export async function deleteScenario(ctx: Ctx, input: { id: string }): Promise<DeleteByIdResponse> {
  await ctx.prisma.scenario.delete({ where: { id: input.id } });
  return { id: input.id };
}
