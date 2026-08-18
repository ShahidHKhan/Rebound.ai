"use client";

import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@rebound/api";

import { trpc } from "@/lib/trpc/client";

type RunDetail = inferRouterOutputs<AppRouter>["adminExperiments"]["testRuns"]["getById"];
type LlmCallRow = RunDetail["llmCalls"][number];
type FixtureType = "ONBOARDING" | "ADJUSTMENT";

const pageStyle: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
};
const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
const rowStyle: React.CSSProperties = { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" };
const thTdStyle: React.CSSProperties = { textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "1px solid #ddd" };
// Caps long tables (run history, LLM calls log) at a fixed height instead of
// letting the page grow unbounded — header row stays pinned while scrolling.
const scrollTableWrapperStyle: React.CSSProperties = {
  maxHeight: 360,
  overflowY: "auto",
  border: "1px solid #ddd",
  borderRadius: 8,
};
const stickyThStyle: React.CSSProperties = {
  ...thTdStyle,
  position: "sticky",
  top: 0,
  background: "var(--background)",
};
const preStyle: React.CSSProperties = {
  background: "#f6f6f6",
  padding: "0.75rem",
  borderRadius: 6,
  overflowX: "auto",
  fontSize: "0.8rem",
  maxHeight: 320,
};

const EXAMPLE_PAYLOAD: Record<FixtureType, string> = {
  ONBOARDING: JSON.stringify(
    {
      answers: {
        age: 30,
        goalType: "MOBILITY",
        conditionFlags: [],
        injurySeverity: "none",
        redFlags: {
          severeSuddenPain: false,
          numbnessOrTingling: false,
          recentTrauma: false,
          recentSurgery: false,
          pregnancyRelated: false,
          cardiacSymptomsWithExertion: false,
        },
      },
      targetMovement: "touching toes without knee bend",
      symptomsText: "Mild stiffness in lower back and hamstrings.",
      lifestyleContextText: "Busy office worker, sits most of the day.",
    },
    null,
    2
  ),
  ADJUSTMENT: JSON.stringify(
    {
      riskTier: "LIGHT_INJURY",
      currentRegime: {
        exercises: [{ exerciseId: "<real exercise id>", durationSeconds: 20, sessionSlot: "MORNING" }],
      },
      trailingSessionLogs: [
        { date: "2026-08-17", painScore: 5, madeItWorseFlag: false },
        { date: "2026-08-16", painScore: 4, madeItWorseFlag: false },
      ],
    },
    null,
    2
  ),
};

function costLabel(costUsd: unknown): string {
  const n = costUsd === null || costUsd === undefined ? null : Number(costUsd);
  return n === null || Number.isNaN(n) ? "—" : `$${n.toFixed(6)}`;
}

function ExerciseList({
  exercises,
  exerciseNames,
}: {
  exercises: { exerciseId: string; sessionSlot: string; sets?: number; reps?: number; durationSeconds?: number; frequency?: string }[];
  exerciseNames: Record<string, { name: string; category: string }>;
}) {
  const morning = exercises.filter((e) => e.sessionSlot === "MORNING");
  const evening = exercises.filter((e) => e.sessionSlot === "EVENING");

  return (
    <>
      {([
        ["Morning", morning],
        ["Evening", evening],
      ] as const).map(([label, group]) => (
        <div key={label} style={{ marginBottom: "0.5rem" }}>
          <strong>{label}</strong>
          {group.length === 0 && <p style={{ margin: "0.25rem 0", opacity: 0.7 }}>None.</p>}
          <ul style={{ margin: "0.25rem 0" }}>
            {group.map((e, i) => {
              const info = exerciseNames[e.exerciseId];
              const prescription = [
                e.sets ? `${e.sets} sets` : null,
                e.reps ? `${e.reps} reps` : null,
                e.durationSeconds ? `${e.durationSeconds}s` : null,
                e.frequency,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={`${e.exerciseId}-${i}`}>
                  {info ? `${info.name} (${info.category.toLowerCase()})` : e.exerciseId}
                  {prescription ? ` — ${prescription}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function TraceView({ llmCalls }: { llmCalls: LlmCallRow[] }) {
  return (
    <div>
      {llmCalls.map((call) => (
        <div key={call.id} style={cardStyle}>
          <p>
            <strong>
              #{call.sequenceIndex} — {call.model}
            </strong>{" "}
            {call.success ? "✓" : "✗ failed"}
          </p>
          <p>
            Tokens: {call.inputTokens} in / {call.outputTokens} out · Latency: {call.latencyMs}ms · Cost:{" "}
            {costLabel(call.costUsd)} · Stop reason: {call.stopReason ?? "—"}
          </p>
          {call.errorMessage && (
            <p role="alert" className="banner banner-error">
              {call.errorMessage}
            </p>
          )}
          <details>
            <summary>Raw request / response</summary>
            <pre style={preStyle}>{JSON.stringify(call.requestJson, null, 2)}</pre>
            {call.responseJson !== null && <pre style={preStyle}>{JSON.stringify(call.responseJson, null, 2)}</pre>}
          </details>
        </div>
      ))}
    </div>
  );
}

function RunResultView({ run }: { run: RunDetail }) {
  const result = run.resultJson as
    | {
        riskTier?: string;
        draft?: { exercises: never[] };
        decision?: string;
        rationale?: string;
        regime?: { exercises: never[] };
        issues?: { code?: string; message: string }[];
        error?: string;
      }
    | null;

  const exercises = result?.draft?.exercises ?? result?.regime?.exercises ?? [];
  const statusColor = run.status === "VALID" ? "banner-success" : run.status === "ERROR" ? "banner-error" : "banner-error";

  return (
    <div style={cardStyle}>
      <p>
        <strong>{run.fixture?.name ?? `Scenario cycle ${run.cycleIndex}`}</strong> — {run.flow} — {run.model}
      </p>
      <p className={`banner ${statusColor}`} style={{ display: "inline-block" }}>
        {run.status}
      </p>
      {result?.error && <p role="alert">{result.error}</p>}
      {result?.decision && (
        <p>
          <strong>Decision: {result.decision}</strong>
          <br />
          {result.rationale}
        </p>
      )}
      {result?.riskTier && <p>Risk tier: {result.riskTier}</p>}
      {exercises.length > 0 && <ExerciseList exercises={exercises} exerciseNames={run.exerciseNames} />}
      {result?.issues && result.issues.length > 0 && (
        <div>
          <strong>Validation issues:</strong>
          <ul>
            {result.issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      <h4>Trace ({run.llmCalls.length} call{run.llmCalls.length === 1 ? "" : "s"})</h4>
      <TraceView llmCalls={run.llmCalls} />
    </div>
  );
}

function RunDetailById({ runId }: { runId: string }) {
  const runQuery = trpc.adminExperiments.testRuns.getById.useQuery({ id: runId });

  if (runQuery.isLoading) {
    return (
      <p>
        <span className="spinner" aria-hidden="true" /> Loading run…
      </p>
    );
  }
  if (runQuery.isError || !runQuery.data) {
    return (
      <p role="alert" className="banner banner-error">
        Couldn&apos;t load run: {runQuery.error?.message}
      </p>
    );
  }
  return <RunResultView run={runQuery.data} />;
}

function FixturesAndRunner() {
  const utils = trpc.useUtils();
  const fixturesQuery = trpc.adminExperiments.fixtures.list.useQuery();
  const modelsQuery = trpc.adminExperiments.availableModels.useQuery();

  const [selectedFixtureId, setSelectedFixtureId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [viewedRunId, setViewedRunId] = useState<string | null>(null);

  const [newFixtureOpen, setNewFixtureOpen] = useState(false);
  const [newFixtureName, setNewFixtureName] = useState("");
  const [newFixtureType, setNewFixtureType] = useState<FixtureType>("ONBOARDING");
  const [newFixturePayload, setNewFixturePayload] = useState(EXAMPLE_PAYLOAD.ONBOARDING);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const createFixture = trpc.adminExperiments.fixtures.create.useMutation({
    onSuccess: () => {
      utils.adminExperiments.fixtures.list.invalidate();
      setNewFixtureOpen(false);
      setNewFixtureName("");
    },
    onError: (error) => setPayloadError(error.message),
  });

  const triggerRun = trpc.adminExperiments.testRuns.trigger.useMutation({
    onSuccess: (data) => {
      setViewedRunId(data.id);
      utils.adminExperiments.testRuns.list.invalidate();
    },
  });

  const runHistory = trpc.adminExperiments.testRuns.list.useQuery();

  function handleCreateFixture() {
    setPayloadError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(newFixturePayload);
    } catch (e) {
      setPayloadError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    createFixture.mutate({ name: newFixtureName, type: newFixtureType, payload: parsed });
  }

  const models = modelsQuery.data ?? [];
  const fixtures = fixturesQuery.data ?? [];

  return (
    <>
      <section style={sectionStyle}>
        <h2>Fixtures</h2>
        {fixturesQuery.isLoading && <p><span className="spinner" aria-hidden="true" /> Loading fixtures…</p>}
        {fixturesQuery.isError && (
          <p role="alert" className="banner banner-error">
            Couldn&apos;t load fixtures: {fixturesQuery.error.message}
          </p>
        )}
        {fixturesQuery.isSuccess && fixtures.length === 0 && <p>No fixtures yet — create one below.</p>}
        {fixtures.map((f) => (
          <div key={f.id} style={cardStyle}>
            <strong>{f.name}</strong> <span>({f.type})</span>
            {f.description && <p style={{ margin: "0.25rem 0" }}>{f.description}</p>}
          </div>
        ))}

        {!newFixtureOpen ? (
          <button type="button" onClick={() => setNewFixtureOpen(true)}>
            + New fixture
          </button>
        ) : (
          <div style={cardStyle}>
            <div style={rowStyle}>
              <label>
                Name{" "}
                <input type="text" value={newFixtureName} onChange={(e) => setNewFixtureName(e.target.value)} />
              </label>
              <label>
                Type{" "}
                <select
                  value={newFixtureType}
                  onChange={(e) => {
                    const type = e.target.value as FixtureType;
                    setNewFixtureType(type);
                    setNewFixturePayload(EXAMPLE_PAYLOAD[type]);
                  }}
                >
                  <option value="ONBOARDING">Onboarding (Flow A)</option>
                  <option value="ADJUSTMENT">Adjustment (Flow B)</option>
                </select>
              </label>
            </div>
            <p>Payload (JSON):</p>
            <textarea
              value={newFixturePayload}
              onChange={(e) => setNewFixturePayload(e.target.value)}
              rows={12}
              style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8rem" }}
            />
            {payloadError && (
              <p role="alert" className="banner banner-error">
                {payloadError}
              </p>
            )}
            <div style={rowStyle}>
              <button
                type="button"
                disabled={createFixture.isPending || !newFixtureName.trim()}
                onClick={handleCreateFixture}
              >
                {createFixture.isPending ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Creating…
                  </>
                ) : (
                  "Create fixture"
                )}
              </button>
              <button type="button" onClick={() => setNewFixtureOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Run a flow</h2>
        {modelsQuery.isError && (
          <p role="alert" className="banner banner-error">
            Couldn&apos;t load available models: {modelsQuery.error.message}
          </p>
        )}
        <div style={rowStyle}>
          <label>
            Fixture{" "}
            <select value={selectedFixtureId} onChange={(e) => setSelectedFixtureId(e.target.value)}>
              <option value="">Select a fixture…</option>
              {fixtures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.type})
                </option>
              ))}
            </select>
          </label>
          <label>
            Model{" "}
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              <option value="">Select a model…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!selectedFixtureId || !selectedModel || triggerRun.isPending}
            onClick={() => triggerRun.mutate({ fixtureId: selectedFixtureId, model: selectedModel })}
          >
            {triggerRun.isPending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Running…
              </>
            ) : (
              "Run"
            )}
          </button>
        </div>
        {triggerRun.isError && (
          <p role="alert" className="banner banner-error">
            {triggerRun.error.message}
          </p>
        )}
      </section>

      {viewedRunId && (
        <section style={sectionStyle}>
          <h2>Result</h2>
          <RunDetailById runId={viewedRunId} />
        </section>
      )}

      <section style={sectionStyle}>
        <h2>Run history</h2>
        {runHistory.isLoading && <p><span className="spinner" aria-hidden="true" /> Loading…</p>}
        {runHistory.isError && (
          <p role="alert" className="banner banner-error">
            Couldn&apos;t load run history: {runHistory.error.message}
          </p>
        )}
        {runHistory.data && runHistory.data.length === 0 && <p>No runs yet.</p>}
        {runHistory.data && runHistory.data.length > 0 && (
          <div style={scrollTableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={stickyThStyle}>Fixture</th>
                  <th style={stickyThStyle}>Flow</th>
                  <th style={stickyThStyle}>Model</th>
                  <th style={stickyThStyle}>Status</th>
                  <th style={stickyThStyle}>Cost</th>
                  <th style={stickyThStyle}>When</th>
                  <th style={stickyThStyle}></th>
                </tr>
              </thead>
              <tbody>
                {runHistory.data.map((run) => {
                  const totalCost = run.llmCalls.reduce((sum, c) => sum + (c.costUsd ? Number(c.costUsd) : 0), 0);
                  return (
                    <tr key={run.id}>
                      <td style={thTdStyle}>{run.fixture?.name ?? `Scenario cycle ${run.cycleIndex}`}</td>
                      <td style={thTdStyle}>{run.flow}</td>
                      <td style={thTdStyle}>{run.model}</td>
                      <td style={thTdStyle}>{run.status}</td>
                      <td style={thTdStyle}>{costLabel(totalCost)}</td>
                      <td style={thTdStyle}>{new Date(run.createdAt).toLocaleString()}</td>
                      <td style={thTdStyle}>
                        <button type="button" onClick={() => setViewedRunId(run.id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function LlmCallsLog() {
  const [flow, setFlow] = useState<string>("");
  const [source, setSource] = useState<string>("");

  const callsQuery = trpc.adminExperiments.llmCalls.list.useQuery({
    flow: (flow || undefined) as never,
    source: (source || undefined) as never,
    limit: 50,
  });

  return (
    <section style={sectionStyle}>
      <h2>LLM calls log</h2>
      <p style={{ opacity: 0.7 }}>Every Anthropic API call, production and admin test alike — most recent 50.</p>
      <div style={rowStyle}>
        <label>
          Flow{" "}
          <select value={flow} onChange={(e) => setFlow(e.target.value)}>
            <option value="">All</option>
            <option value="FLOW_A_DRAFT">Flow A (draft)</option>
            <option value="FLOW_B_ADJUST">Flow B (adjust)</option>
            <option value="FREE_TEXT_CLASSIFIER">Free-text classifier</option>
          </select>
        </label>
        <label>
          Source{" "}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="PRODUCTION">Production</option>
            <option value="ADMIN_TEST">Admin test</option>
          </select>
        </label>
      </div>

      {callsQuery.isLoading && <p><span className="spinner" aria-hidden="true" /> Loading…</p>}
      {callsQuery.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load calls: {callsQuery.error.message}
        </p>
      )}
      {callsQuery.data && callsQuery.data.length === 0 && <p>No calls logged yet.</p>}
      {callsQuery.data && callsQuery.data.length > 0 && (
        <div style={scrollTableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={stickyThStyle}>When</th>
                <th style={stickyThStyle}>Flow</th>
                <th style={stickyThStyle}>Source</th>
                <th style={stickyThStyle}>Model</th>
                <th style={stickyThStyle}>Tokens</th>
                <th style={stickyThStyle}>Latency</th>
                <th style={stickyThStyle}>Cost</th>
                <th style={stickyThStyle}>OK?</th>
              </tr>
            </thead>
            <tbody>
              {callsQuery.data.map((call) => (
                <tr key={call.id}>
                  <td style={thTdStyle}>{new Date(call.createdAt).toLocaleString()}</td>
                  <td style={thTdStyle}>{call.flow}</td>
                  <td style={thTdStyle}>{call.source}</td>
                  <td style={thTdStyle}>{call.model}</td>
                  <td style={thTdStyle}>
                    {call.inputTokens}/{call.outputTokens}
                  </td>
                  <td style={thTdStyle}>{call.latencyMs}ms</td>
                  <td style={thTdStyle}>{costLabel(call.costUsd)}</td>
                  <td style={thTdStyle}>{call.success ? "✓" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminExperimentsPage() {
  return (
    <main style={pageStyle}>
      <p>
        <Link href="/admin">← Back to Admin</Link>
      </p>
      <h1>Flow experimentation</h1>
      <p style={{ opacity: 0.7 }}>
        Dry-run Flow A / Flow B against synthetic fixtures with any model — never touches real user data.
      </p>
      <p>
        <Link href="/admin/experiments/scenarios">Scenarios (chain Flow A → Flow B, with charts) →</Link>
      </p>
      <FixturesAndRunner />
      <LlmCallsLog />
    </main>
  );
}
