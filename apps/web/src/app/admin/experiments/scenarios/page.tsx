"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

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

function costLabel(cost: number): string {
  return `$${cost.toFixed(6)}`;
}

function StartScenarioForm() {
  const router = useRouter();
  const fixturesQuery = trpc.adminExperiments.fixtures.list.useQuery({ type: "ONBOARDING" });
  const modelsQuery = trpc.adminExperiments.availableModels.useQuery();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [model, setModel] = useState("");

  const start = trpc.adminExperiments.scenarios.start.useMutation({
    onSuccess: (data) => router.push(`/admin/experiments/scenarios/${data.scenario.id}`),
  });

  const fixtures = fixturesQuery.data ?? [];
  const models = modelsQuery.data ?? [];

  return (
    <div style={cardStyle}>
      <h3>Start a new scenario</h3>
      <p style={{ opacity: 0.7 }}>
        Runs Flow A against an onboarding fixture to draft cycle 0, then you can chain synthetic Flow B cycles
        against it.
      </p>
      {(fixturesQuery.isError || modelsQuery.isError) && (
        <p role="alert" className="banner banner-error">
          {fixturesQuery.error?.message ?? modelsQuery.error?.message}
        </p>
      )}
      <div style={rowStyle}>
        <label>
          Name <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Description (optional){" "}
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div style={rowStyle}>
        <label>
          Onboarding fixture{" "}
          <select value={fixtureId} onChange={(e) => setFixtureId(e.target.value)}>
            <option value="">Select…</option>
            {fixtures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model{" "}
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Select…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!name.trim() || !fixtureId || !model || start.isPending}
          onClick={() => start.mutate({ name, description: description || undefined, fixtureId, model })}
        >
          {start.isPending ? (
            <>
              <span className="spinner" aria-hidden="true" /> Starting…
            </>
          ) : (
            "Start scenario"
          )}
        </button>
      </div>
      {start.isError && (
        <p role="alert" className="banner banner-error">
          {start.error.message}
        </p>
      )}
    </div>
  );
}

export default function ScenariosPage() {
  const listQuery = trpc.adminExperiments.scenarios.list.useQuery();
  const scenarios = listQuery.data ?? [];

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/admin/experiments">← Back to Flow experimentation</Link>
      </p>
      <h1>Scenarios</h1>
      <p style={{ opacity: 0.7 }}>
        Watch Flow B adjust a regime it never saw during onboarding — chain synthetic session-log cycles against a
        real Flow A draft, entirely sandboxed from real user data.
      </p>

      <section style={sectionStyle}>
        <StartScenarioForm />
      </section>

      <section style={sectionStyle}>
        <h2>Existing scenarios</h2>
        {listQuery.isLoading && (
          <p>
            <span className="spinner" aria-hidden="true" /> Loading…
          </p>
        )}
        {listQuery.isError && (
          <p role="alert" className="banner banner-error">
            {listQuery.error.message}
          </p>
        )}
        {listQuery.isSuccess && scenarios.length === 0 && <p>No scenarios yet — start one above.</p>}
        {scenarios.length > 0 && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thTdStyle}>Name</th>
                <th style={thTdStyle}>Cycles</th>
                <th style={thTdStyle}>Latest status</th>
                <th style={thTdStyle}>Total cost</th>
                <th style={thTdStyle}>Created</th>
                <th style={thTdStyle}></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td style={thTdStyle}>{s.name}</td>
                  <td style={thTdStyle}>{s.cycleCount}</td>
                  <td style={thTdStyle}>{s.latestStatus ?? "—"}</td>
                  <td style={thTdStyle}>{costLabel(s.totalCost)}</td>
                  <td style={thTdStyle}>{new Date(s.createdAt).toLocaleString()}</td>
                  <td style={thTdStyle}>
                    <Link href={`/admin/experiments/scenarios/${s.id}`}>View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
