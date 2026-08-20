import { prisma } from "@rebound/db";
import type { Scenario, SyntheticPainPattern, TestFixture, TestRun } from "@rebound/db";
import { determineRiskTier, validateRegime, validateStructure } from "@rebound/clinical-rules";
import type { DraftRegime, OnboardingAnswers, RiskTier } from "@rebound/clinical-rules";

import { generateInitialRegime } from "./flow-a";
import { proposeAdjustment } from "./flow-b";
import { generateSyntheticSessionLogs } from "./synthetic-session-logs";

// Shape a TestFixture of type ONBOARDING must match — mirrors
// packages/api/src/schemas.ts's onboardingSubmissionSchema exactly (fixture
// payloads are validated against that schema before being persisted).
interface OnboardingFixturePayload {
  answers: OnboardingAnswers;
  targetMovement: string;
  symptomsText: string;
  lifestyleContextText: string;
}

// Shape a TestFixture of type ADJUSTMENT must match — mirrors
// packages/api/src/schemas.ts's adjustmentFixtureSchema.
interface AdjustmentFixturePayload {
  riskTier: RiskTier;
  currentRegime: DraftRegime;
  trailingSessionLogs: Array<{ date: string; painScore: number; madeItWorseFlag: boolean }>;
}

export interface TestRunResult {
  testRunId: string;
  status: "VALID" | "INVALID" | "ERROR";
  result: unknown;
}

// Shared by every run function below: executes `compute`, persists whatever
// status/result it returns (or ERROR on a thrown exception, e.g. the
// Anthropic call itself failing) onto the already-created TestRun row, and
// returns the same shape either way.
async function persistTestRunResult(
  testRunId: string,
  compute: () => Promise<{ status: "VALID" | "INVALID"; result: object }>
): Promise<TestRunResult> {
  try {
    const { status, result } = await compute();
    await prisma.testRun.update({ where: { id: testRunId }, data: { status, resultJson: result as unknown as object } });
    return { testRunId, status, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = { error: message };
    await prisma.testRun.update({ where: { id: testRunId }, data: { status: "ERROR", resultJson: result } });
    return { testRunId, status: "ERROR", result };
  }
}

// Dry-runs Flow A against a synthetic fixture: drafts + structurally/
// clinically validates a regime exactly like real onboarding does, but
// never calls upsertUserForOnboarding and never writes a Regime row — the
// isolation guarantee that keeps this from touching real user data.
//
// Passing `scenario` marks this as a Scenario's cycle 0 (see
// runScenarioFlowBCycle below) rather than a standalone dry run — existing
// callers that don't pass it get identical behavior to before.
export async function runFlowATestRun(
  fixture: TestFixture,
  model: string,
  adminUserId: string,
  scenario?: { scenarioId: string }
): Promise<TestRunResult> {
  const payload = fixture.payload as unknown as OnboardingFixturePayload;

  const testRun = await prisma.testRun.create({
    data: {
      fixtureId: fixture.id,
      flow: "FLOW_A_DRAFT",
      model,
      createdByUserId: adminUserId,
      ...(scenario
        ? { scenarioId: scenario.scenarioId, cycleIndex: 0, inputJson: payload as unknown as object }
        : {}),
    },
  });

  return persistTestRunResult(testRun.id, async () => {
    const riskTier = determineRiskTier(payload.answers);

    const { draft, sourcePresetId } = await generateInitialRegime(
      {
        goalType: payload.answers.goalType,
        targetMovement: payload.targetMovement,
        riskTier,
        symptomsText: payload.symptomsText,
        lifestyleContextText: payload.lifestyleContextText,
      },
      { model, source: "ADMIN_TEST", testRunId: testRun.id }
    );

    const structural = validateStructure(draft);
    if (!structural.success) {
      return { status: "INVALID", result: { riskTier, draft, sourcePresetId, issues: structural.error.issues } };
    }

    const clinical = validateRegime(draft, riskTier);
    return {
      status: clinical.valid ? "VALID" : "INVALID",
      result: { riskTier, draft, sourcePresetId, issues: clinical.valid ? [] : clinical.issues },
    };
  });
}

interface FlowBContext {
  riskTier: RiskTier;
  currentRegime: DraftRegime;
  trailingSessionLogs: Array<{ date: string; painScore: number; madeItWorseFlag: boolean }>;
}

// Shared Flow B body: propose + structurally/clinically validate (with
// previousRegime supplied, so the real delta check runs, same as production
// Flow B). Used by both the fixture-driven and scenario-chain paths below.
async function computeFlowBAdjustment(context: FlowBContext, model: string, testRunId: string) {
  const proposal = await proposeAdjustment(
    { riskTier: context.riskTier, currentRegime: context.currentRegime, trailingSessionLogs: context.trailingSessionLogs },
    undefined,
    { model, source: "ADMIN_TEST", testRunId }
  );

  const structural = validateStructure(proposal.regime);
  if (!structural.success) {
    return {
      status: "INVALID" as const,
      result: { decision: proposal.decision, rationale: proposal.rationale, regime: proposal.regime, issues: structural.error.issues },
    };
  }

  const clinical = validateRegime(proposal.regime, context.riskTier, context.currentRegime);
  const status: "VALID" | "INVALID" = clinical.valid ? "VALID" : "INVALID";
  return {
    status,
    result: {
      decision: proposal.decision,
      rationale: proposal.rationale,
      regime: proposal.regime,
      issues: clinical.valid ? [] : clinical.issues,
    },
  };
}

// Dry-runs Flow B against a synthetic (static) fixture — but never touches
// AdjustmentEvent or any real Regime. Standalone, no Scenario chaining.
export async function runFlowBTestRun(fixture: TestFixture, model: string, adminUserId: string): Promise<TestRunResult> {
  const payload = fixture.payload as unknown as AdjustmentFixturePayload;

  const testRun = await prisma.testRun.create({
    data: { fixtureId: fixture.id, flow: "FLOW_B_ADJUST", model, createdByUserId: adminUserId },
  });

  return persistTestRunResult(testRun.id, () => computeFlowBAdjustment(payload, model, testRun.id));
}

function extractCurrentRegime(resultJson: unknown): DraftRegime {
  const parsed = resultJson as { draft?: DraftRegime; regime?: DraftRegime } | null;
  const regime = parsed?.draft ?? parsed?.regime;
  if (!regime) {
    throw new Error("Previous cycle has no regime to continue from — was it VALID?");
  }
  return regime;
}

// Risk tier is set once at onboarding and never revisited (a known,
// documented PRD gap, not something this simulator should paper over) — so
// every cycle in a scenario reads it from cycle 0, not from whichever cycle
// immediately precedes it (Flow B's own result shape doesn't carry riskTier
// at all, only Flow A's does).
async function getScenarioRiskTier(scenarioId: string): Promise<RiskTier> {
  const cycleZero = await prisma.testRun.findFirst({ where: { scenarioId, cycleIndex: 0 } });
  const riskTier = (cycleZero?.resultJson as { riskTier?: RiskTier } | null)?.riskTier;
  if (!riskTier) {
    throw new Error("Scenario's cycle 0 has no riskTier recorded — was Flow A's run VALID?");
  }
  return riskTier;
}

// Runs one Flow B cycle within a Scenario chain: reads the current regime
// from the previous cycle's stored result, generates a fresh batch of
// synthetic trailing logs for the chosen pain pattern, and proposes/
// validates an adjustment exactly like production Flow B — still never
// touching AdjustmentEvent or any real Regime.
export async function runScenarioFlowBCycle(
  scenario: Scenario,
  previousTestRun: TestRun,
  painPattern: SyntheticPainPattern,
  days: number,
  model: string,
  adminUserId: string
): Promise<TestRunResult> {
  const currentRegime = extractCurrentRegime(previousTestRun.resultJson);
  const riskTier = await getScenarioRiskTier(scenario.id);
  const trailingSessionLogs = generateSyntheticSessionLogs(painPattern, days);
  const cycleIndex = (previousTestRun.cycleIndex ?? 0) + 1;
  const inputJson = { painPattern, days, trailingSessionLogs };

  const testRun = await prisma.testRun.create({
    data: {
      flow: "FLOW_B_ADJUST",
      model,
      createdByUserId: adminUserId,
      scenarioId: scenario.id,
      cycleIndex,
      inputJson: inputJson as unknown as object,
    },
  });

  return persistTestRunResult(testRun.id, () =>
    computeFlowBAdjustment({ riskTier, currentRegime, trailingSessionLogs }, model, testRun.id)
  );
}
