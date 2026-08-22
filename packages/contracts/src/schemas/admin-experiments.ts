import { z } from "zod";

import { registry } from "../registry";
import { sessionSlotSchema } from "./regime";

export const llmFlowSchema = z.enum(["FLOW_A_DRAFT", "FLOW_B_ADJUST", "FREE_TEXT_CLASSIFIER"]);
export const llmCallSourceSchema = z.enum(["PRODUCTION", "ADMIN_TEST"]);
export const testFixtureTypeSchema = z.enum(["ONBOARDING", "ADJUSTMENT"]);
export const testRunStatusSchema = z.enum(["RUNNING", "VALID", "INVALID", "ERROR"]);
export const syntheticPainPatternSchema = z.enum(["IMPROVING", "PLATEAUING", "WORSENING", "CONTRADICTORY"]);

// --- models ---

const availableModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  inputPerMTok: z.number(),
  outputPerMTok: z.number(),
});
export const availableModelsResponseSchema = registry.register("AvailableModels", z.array(availableModelSchema));

// --- fixtures ---

export const testFixtureResponseSchema = registry.register(
  "TestFixture",
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    type: testFixtureTypeSchema,
    // Matches onboardingSubmissionSchema or adjustmentFixtureSchema depending
    // on `type` — validated server-side at creation time (see handler), but
    // deliberately not re-typed as a union here: this is debug-tooling
    // payload storage, not a safety-relevant contract like Flow A/B's own
        // input/output schemas.
    payload: z.unknown(),
    createdAt: z.string().datetime(),
  })
);
export type TestFixtureResponse = z.infer<typeof testFixtureResponseSchema>;

export const testFixtureListResponseSchema = registry.register("TestFixtures", z.array(testFixtureResponseSchema));

export const createTestFixtureRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  type: testFixtureTypeSchema,
  payload: z.unknown(),
});
export type CreateTestFixtureInput = z.infer<typeof createTestFixtureRequestSchema>;

export const deleteByIdResponseSchema = registry.register("DeleteByIdResponse", z.object({ id: z.string() }));
export type DeleteByIdResponse = z.infer<typeof deleteByIdResponseSchema>;

// --- LLM calls ---

export const llmCallResponseSchema = registry.register(
  "LlmCall",
  z.object({
    id: z.string(),
    createdAt: z.string().datetime(),
    flow: llmFlowSchema,
    source: llmCallSourceSchema,
    model: z.string(),
    groupId: z.string(),
    sequenceIndex: z.number().int(),
    userId: z.string().nullable(),
    testRunId: z.string().nullable(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    latencyMs: z.number().int(),
    // Prisma's Decimal serializes to a numeric string via Response.json()
    // (Decimal.js's own toJSON()), not a JS number — every existing client
    // call site already wraps this in Number(...), so this is a typing
    // change only, not a behavioral one.
    costUsd: z.string().nullable(),
    stopReason: z.string().nullable(),
    success: z.boolean(),
    errorMessage: z.string().nullable(),
    requestJson: z.unknown(),
    responseJson: z.unknown().nullable(),
  })
);
export type LlmCallResponse = z.infer<typeof llmCallResponseSchema>;

export const llmCallListResponseSchema = registry.register("LlmCalls", z.array(llmCallResponseSchema));

export const listLlmCallsQuerySchema = z.object({
  flow: llmFlowSchema.optional(),
  source: llmCallSourceSchema.optional(),
  model: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListLlmCallsInput = z.infer<typeof listLlmCallsQuerySchema>;

// --- test runs ---

const exerciseNamesSchema = z.record(z.string(), z.object({ name: z.string(), category: z.string() }));

// Full detail — testRuns.trigger/getById and every scenario endpoint. Same
// "don't force a shape onto Json" reasoning as TestFixture.payload:
// resultJson/inputJson vary by flow (Flow A's {draft,...} vs Flow B's
// {regime, decision, rationale,...}), this is trace-inspection tooling, not
// a safety-relevant contract.
export const testRunDetailResponseSchema = registry.register(
  "TestRunDetail",
  z.object({
    id: z.string(),
    fixtureId: z.string().nullable(),
    flow: llmFlowSchema,
    model: z.string(),
    status: testRunStatusSchema,
    resultJson: z.unknown().nullable(),
    createdByUserId: z.string(),
    createdAt: z.string().datetime(),
    scenarioId: z.string().nullable(),
    cycleIndex: z.number().int().nullable(),
    inputJson: z.unknown().nullable(),
    llmCalls: z.array(llmCallResponseSchema),
    fixture: testFixtureResponseSchema.nullable(),
    exerciseNames: exerciseNamesSchema,
  })
);
export type TestRunDetailResponse = z.infer<typeof testRunDetailResponseSchema>;

// Lighter list-view shape — testRuns.list's Prisma query only ever selects
// fixture.name and llmCalls[].costUsd, not the full relations.
export const testRunSummaryResponseSchema = registry.register(
  "TestRunSummary",
  z.object({
    id: z.string(),
    fixtureId: z.string().nullable(),
    flow: llmFlowSchema,
    model: z.string(),
    status: testRunStatusSchema,
    resultJson: z.unknown().nullable(),
    createdByUserId: z.string(),
    createdAt: z.string().datetime(),
    scenarioId: z.string().nullable(),
    cycleIndex: z.number().int().nullable(),
    inputJson: z.unknown().nullable(),
    fixture: z.object({ name: z.string() }).nullable(),
    llmCalls: z.array(z.object({ costUsd: z.string().nullable() })),
  })
);

export const testRunSummaryListResponseSchema = registry.register(
  "TestRunSummaries",
  z.array(testRunSummaryResponseSchema)
);

export const triggerTestRunRequestSchema = z.object({
  fixtureId: z.string(),
  model: z.string(),
});
export type TriggerTestRunInput = z.infer<typeof triggerTestRunRequestSchema>;

// --- regime diffs (shared by scenario endpoints) ---

// Mirrors packages/agents/src/regime-diff.ts's RegimeDiffEntry — display-only
// (diff output), so no min/max bounds the way request-validation schemas
// carry; deliberately not the same schema as regimeExerciseEditSchema
// (different bounds, different purpose — same "don't reconcile" reasoning
// as Phase 4's regime schemas).
const diffExerciseSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().optional(),
  reps: z.number().int().optional(),
  durationSeconds: z.number().int().optional(),
  frequency: z.string().optional(),
  sessionSlot: sessionSlotSchema,
});

const regimeDiffEntrySchema = z.object({
  exerciseId: z.string(),
  change: z.enum(["added", "removed", "changed", "unchanged"]),
  before: diffExerciseSchema.optional(),
  after: diffExerciseSchema.optional(),
  changedFields: z.array(z.string()).optional(),
});

// --- scenarios ---

const scenarioResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  createdByUserId: z.string(),
});

export const startScenarioRequestSchema = z.object({
  fixtureId: z.string(),
  model: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});
export type StartScenarioInput = z.infer<typeof startScenarioRequestSchema>;

export const startScenarioResponseSchema = registry.register(
  "ScenarioStartResponse",
  z.object({
    scenario: scenarioResponseSchema,
    testRun: testRunDetailResponseSchema,
  })
);

export const runNextCycleRequestSchema = z.object({
  painPattern: syntheticPainPatternSchema,
  days: z.number().int().min(3).max(21).default(7),
  model: z.string(),
});
export type RunNextCycleInput = z.infer<typeof runNextCycleRequestSchema>;

// Shared by scenarios.runNextCycle's direct response and every entry in
// scenarios.getById's `cycles` array.
export const scenarioCycleResponseSchema = registry.register(
  "ScenarioCycleResponse",
  testRunDetailResponseSchema.extend({
    diffFromPrevious: z.array(regimeDiffEntrySchema).nullable(),
    diffFromOriginal: z.array(regimeDiffEntrySchema).nullable(),
  })
);
export type ScenarioCycleResponse = z.infer<typeof scenarioCycleResponseSchema>;

const scenarioSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  cycleCount: z.number().int(),
  latestStatus: testRunStatusSchema.nullable(),
  totalCost: z.number(),
});

export const scenarioListResponseSchema = registry.register("ScenarioSummaries", z.array(scenarioSummarySchema));

const painTimelineEntrySchema = z.object({
  simulatedDay: z.number().int(),
  painScore: z.number().int(),
  madeItWorseFlag: z.boolean(),
  cycleIndex: z.number().int(),
});

export const scenarioDetailResponseSchema = registry.register(
  "ScenarioDetailResponse",
  z.object({
    scenario: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      createdAt: z.string().datetime(),
    }),
    cycles: z.array(scenarioCycleResponseSchema),
    painTimeline: z.array(painTimelineEntrySchema),
  })
);

// --- paths ---

registry.registerPath({
  method: "get",
  path: "/admin/experiments/models",
  tags: ["admin-experiments"],
  summary: "Models available for a dry run",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: availableModelsResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

const fixturesListQuerySchema = z.object({ type: testFixtureTypeSchema.optional() });

registry.registerPath({
  method: "get",
  path: "/admin/experiments/fixtures",
  tags: ["admin-experiments"],
  summary: "List saved test fixtures",
  security: [{ bearerAuth: [] }],
  request: { query: fixturesListQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: testFixtureListResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/experiments/fixtures",
  tags: ["admin-experiments"],
  summary: "Save a new test fixture — payload validated against the real onboarding/adjustment schema",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createTestFixtureRequestSchema } } } },
  responses: {
    200: { description: "Created", content: { "application/json": { schema: testFixtureResponseSchema } } },
    400: { description: "Payload doesn't match the declared type's shape" },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

const fixtureIdParamSchema = z.object({ id: z.string() });

registry.registerPath({
  method: "delete",
  path: "/admin/experiments/fixtures/{id}",
  tags: ["admin-experiments"],
  summary: "Delete a test fixture (blocked if any test run references it)",
  security: [{ bearerAuth: [] }],
  request: { params: fixtureIdParamSchema },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: deleteByIdResponseSchema } } },
    400: { description: "Referenced by existing test runs" },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/experiments/test-runs",
  tags: ["admin-experiments"],
  summary: "Dry-run Flow A or Flow B against a fixture with a chosen model",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: triggerTestRunRequestSchema } } } },
  responses: {
    200: { description: "Run complete", content: { "application/json": { schema: testRunDetailResponseSchema } } },
    400: { description: "Unknown model" },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
    404: { description: "Fixture not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/experiments/test-runs",
  tags: ["admin-experiments"],
  summary: "List the last 50 test runs",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: testRunSummaryListResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

const testRunIdParamSchema = z.object({ id: z.string() });

registry.registerPath({
  method: "get",
  path: "/admin/experiments/test-runs/{id}",
  tags: ["admin-experiments"],
  summary: "Get a test run's full detail, including its LLM call trace",
  security: [{ bearerAuth: [] }],
  request: { params: testRunIdParamSchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: testRunDetailResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
    404: { description: "No test run with this id" },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/experiments/llm-calls",
  tags: ["admin-experiments"],
  summary: "List logged LLM calls (production and admin-test), most recent first",
  security: [{ bearerAuth: [] }],
  request: { query: listLlmCallsQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: llmCallListResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

registry.registerPath({
  method: "post",
  path: "/admin/experiments/scenarios",
  tags: ["admin-experiments"],
  summary: "Start a scenario — cycle 0 is a real Flow A dry run against an ONBOARDING fixture",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: startScenarioRequestSchema } } } },
  responses: {
    200: { description: "Started", content: { "application/json": { schema: startScenarioResponseSchema } } },
    400: { description: "Unknown model, or fixture isn't ONBOARDING type" },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
    404: { description: "Fixture not found" },
  },
});

const scenarioIdParamSchema = z.object({ id: z.string() });

registry.registerPath({
  method: "post",
  path: "/admin/experiments/scenarios/{id}/next-cycle",
  tags: ["admin-experiments"],
  summary: "Run one more synthetic Flow B cycle against a scenario's most recent valid cycle",
  security: [{ bearerAuth: [] }],
  request: {
    params: scenarioIdParamSchema,
    body: { content: { "application/json": { schema: runNextCycleRequestSchema } } },
  },
  responses: {
    200: { description: "Cycle complete", content: { "application/json": { schema: scenarioCycleResponseSchema } } },
    400: { description: "Unknown model, no prior cycle, or the previous cycle isn't VALID" },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
    404: { description: "Scenario not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/experiments/scenarios",
  tags: ["admin-experiments"],
  summary: "List scenarios with aggregated cost and latest cycle status",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: scenarioListResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});

registry.registerPath({
  method: "get",
  path: "/admin/experiments/scenarios/{id}",
  tags: ["admin-experiments"],
  summary: "Get a scenario's full cycle chain, diffs, and flattened pain timeline",
  security: [{ bearerAuth: [] }],
  request: { params: scenarioIdParamSchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: scenarioDetailResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
    404: { description: "No scenario with this id" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/admin/experiments/scenarios/{id}",
  tags: ["admin-experiments"],
  summary: "Delete a scenario and every cycle/LLM-call trace under it (cascades)",
  security: [{ bearerAuth: [] }],
  request: { params: scenarioIdParamSchema },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: deleteByIdResponseSchema } } },
    401: { description: "Not authenticated" },
    403: { description: "Not an admin" },
  },
});
