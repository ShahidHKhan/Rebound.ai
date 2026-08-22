"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import { qk } from "@/lib/rest/query-keys";
import type { components } from "@/lib/rest/schema";

type ScenarioDetail = components["schemas"]["ScenarioDetailResponse"];
type Cycle = ScenarioDetail["cycles"][number];
type PainPoint = ScenarioDetail["painTimeline"][number];
type DiffEntry = NonNullable<Cycle["diffFromPrevious"]>[number];

const pageStyle: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
};
const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
const rowStyle: React.CSSProperties = { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" };
const thTdStyle: React.CSSProperties = { textAlign: "left", padding: "0.35rem 0.5rem", borderBottom: "1px solid #ddd" };
const preStyle: React.CSSProperties = {
  background: "#f6f6f6",
  padding: "0.75rem",
  borderRadius: 6,
  overflowX: "auto",
  fontSize: "0.8rem",
  maxHeight: 280,
};

function costLabel(costUsd: unknown): string {
  const n = costUsd === null || costUsd === undefined ? 0 : Number(costUsd);
  return `$${n.toFixed(6)}`;
}

function cycleCost(cycle: Cycle): number {
  return cycle.llmCalls.reduce((sum, c) => sum + (c.costUsd ? Number(c.costUsd) : 0), 0);
}

function statusColorVar(decision: string | undefined): string {
  if (decision === "rollback") return "var(--viz-status-critical)";
  if (decision === "progress") return "var(--viz-status-good)";
  return "var(--viz-text-muted)"; // hold, or no decision (cycle 0)
}

// ── Pain trend chart — single-series line, form: change over time. One
// identity color for the line (never recolored by decision — "color follows
// the entity, not its rank"); cycle-boundary decisions are separate marker
// annotations, not a repaint of the line itself. Crosshair + tooltip per the
// dataviz skill's interaction spec (mandatory for line charts).
function PainTrendChart({ painTimeline, cycles }: { painTimeline: PainPoint[]; cycles: Cycle[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (painTimeline.length === 0) {
    return <p style={{ opacity: 0.7 }}>No synthetic session logs yet — run a Flow B cycle to see the pain trend.</p>;
  }

  const width = 640;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 28, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxDay = Math.max(...painTimeline.map((p) => p.simulatedDay));
  const x = (day: number) => padding.left + (maxDay <= 1 ? 0 : ((day - 1) / (maxDay - 1)) * plotWidth);
  const y = (pain: number) => padding.top + plotHeight - (pain / 10) * plotHeight;

  const linePath = painTimeline.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.simulatedDay)},${y(p.painScore)}`).join(" ");

  // Cycle-boundary annotations: the last point of each Flow B cycle, labeled
  // with that cycle's decision.
  const boundaries = cycles
    .filter((c) => c.cycleIndex !== null && c.cycleIndex > 0)
    .map((c) => {
      const points = painTimeline.filter((p) => p.cycleIndex === c.cycleIndex);
      const lastPoint = points[points.length - 1];
      const decision = (c.resultJson as { decision?: string } | null)?.decision;
      return lastPoint ? { day: lastPoint.simulatedDay, decision, cycleIndex: c.cycleIndex } : null;
    })
    .filter((b): b is { day: number; decision: string | undefined; cycleIndex: number | null } => b !== null);

  const hovered = hoverIndex !== null ? painTimeline[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * width;
    const day = 1 + ((relativeX - padding.left) / plotWidth) * (maxDay - 1);
    let nearest = 0;
    let nearestDist = Infinity;
    painTimeline.forEach((p, i) => {
      const dist = Math.abs(p.simulatedDay - day);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="viz-root">
      <h3>Pain trend</h3>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", background: "var(--viz-surface)" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {/* Y gridlines + labels, 0/2/4/6/8/10 */}
          {[0, 2, 4, 6, 8, 10].map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--viz-gridline)"
                strokeWidth={1}
              />
              <text x={padding.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={10} fill="var(--viz-text-muted)">
                {tick}
              </text>
            </g>
          ))}
          {/* Baseline */}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
            stroke="var(--viz-baseline)"
            strokeWidth={1}
          />

          {/* Cycle boundary annotations */}
          {boundaries.map((b) => (
            <g key={b.cycleIndex}>
              <line
                x1={x(b.day)}
                x2={x(b.day)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke={statusColorVar(b.decision)}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.6}
              />
              <circle cx={x(b.day)} cy={padding.top} r={4} fill={statusColorVar(b.decision)} />
              <text x={x(b.day)} y={padding.top - 4} textAnchor="middle" fontSize={9} fill="var(--viz-text-secondary)">
                {b.decision ?? "?"}
              </text>
            </g>
          ))}

          {/* The line */}
          <path d={linePath} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Hover crosshair + marker */}
          {hovered && (
            <g>
              <line
                x1={x(hovered.simulatedDay)}
                x2={x(hovered.simulatedDay)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke="var(--viz-text-muted)"
                strokeWidth={1}
              />
              <circle
                cx={x(hovered.simulatedDay)}
                cy={y(hovered.painScore)}
                r={5}
                fill="var(--viz-series-1)"
                stroke="var(--viz-surface)"
                strokeWidth={2}
              />
            </g>
          )}

          <text x={width - padding.right} y={height - 6} textAnchor="end" fontSize={10} fill="var(--viz-text-muted)">
            simulated day →
          </text>
        </svg>
        {hovered && (
          <div
            role="tooltip"
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              background: "var(--viz-surface)",
              border: "1px solid var(--viz-gridline)",
              borderRadius: 6,
              padding: "0.4rem 0.6rem",
              fontSize: "0.8rem",
              color: "var(--viz-text-primary)",
              pointerEvents: "none",
            }}
          >
            <strong>Day {hovered.simulatedDay}</strong> (cycle {hovered.cycleIndex}) — pain {hovered.painScore}/10
            {hovered.madeItWorseFlag ? " — made it worse" : ""}
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable((v) => !v)} style={{ fontSize: "0.8rem" }}>
        {showTable ? "Hide" : "Show"} as table
      </button>
      {showTable && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thTdStyle}>Day</th>
              <th style={thTdStyle}>Cycle</th>
              <th style={thTdStyle}>Pain</th>
              <th style={thTdStyle}>Made it worse</th>
            </tr>
          </thead>
          <tbody>
            {painTimeline.map((p) => (
              <tr key={p.simulatedDay}>
                <td style={thTdStyle}>{p.simulatedDay}</td>
                <td style={thTdStyle}>{p.cycleIndex}</td>
                <td style={thTdStyle}>{p.painScore}</td>
                <td style={thTdStyle}>{p.madeItWorseFlag ? "yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── LLM cost bar chart — form: compare magnitude across cycles. One
// identity hue (sequential default), per-bar hover tooltip (the mark is the
// hit target, no crosshair needed for bars).
function CostBarChart({ cycles }: { cycles: Cycle[] }) {
  const [hoverCycle, setHoverCycle] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const data = cycles.map((c) => ({ cycleIndex: c.cycleIndex ?? 0, flow: c.flow, cost: cycleCost(c) }));
  const width = 640;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxCost = Math.max(...data.map((d) => d.cost), 0.000001);
  const bandWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.min(24, bandWidth * 0.6);

  const barY = (cost: number) => padding.top + plotHeight - (cost / maxCost) * plotHeight;
  const barHeight = (cost: number) => (cost / maxCost) * plotHeight;

  const hovered = hoverCycle !== null ? data.find((d) => d.cycleIndex === hoverCycle) : null;

  return (
    <div className="viz-root">
      <h3>LLM cost per cycle</h3>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", background: "var(--viz-surface)" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <line
              key={frac}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + plotHeight * (1 - frac)}
              y2={padding.top + plotHeight * (1 - frac)}
              stroke="var(--viz-gridline)"
              strokeWidth={1}
            />
          ))}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
            stroke="var(--viz-baseline)"
            strokeWidth={1}
          />
          <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" fontSize={9} fill="var(--viz-text-muted)">
            ${maxCost.toFixed(4)}
          </text>
          <text x={padding.left - 6} y={padding.top + plotHeight} textAnchor="end" fontSize={9} fill="var(--viz-text-muted)">
            $0
          </text>

          {data.map((d, i) => {
            const bandCenter = padding.left + bandWidth * (i + 0.5);
            return (
              <g key={d.cycleIndex}>
                <rect
                  x={bandCenter - barWidth / 2}
                  y={barY(d.cost)}
                  width={barWidth}
                  height={Math.max(1, barHeight(d.cost))}
                  rx={4}
                  fill="var(--viz-series-1)"
                  opacity={hoverCycle === d.cycleIndex ? 0.75 : 1}
                  onPointerEnter={() => setHoverCycle(d.cycleIndex)}
                  onPointerLeave={() => setHoverCycle(null)}
                  onFocus={() => setHoverCycle(d.cycleIndex)}
                  onBlur={() => setHoverCycle(null)}
                  tabIndex={0}
                />
                <text x={bandCenter} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--viz-text-muted)">
                  C{d.cycleIndex}
                </text>
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            role="tooltip"
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              background: "var(--viz-surface)",
              border: "1px solid var(--viz-gridline)",
              borderRadius: 6,
              padding: "0.4rem 0.6rem",
              fontSize: "0.8rem",
              color: "var(--viz-text-primary)",
              pointerEvents: "none",
            }}
          >
            <strong>Cycle {hovered.cycleIndex}</strong> ({hovered.flow}) — {costLabel(hovered.cost)}
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable((v) => !v)} style={{ fontSize: "0.8rem" }}>
        {showTable ? "Hide" : "Show"} as table
      </button>
      {showTable && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thTdStyle}>Cycle</th>
              <th style={thTdStyle}>Flow</th>
              <th style={thTdStyle}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.cycleIndex}>
                <td style={thTdStyle}>{d.cycleIndex}</td>
                <td style={thTdStyle}>{d.flow}</td>
                <td style={thTdStyle}>{costLabel(d.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DiffTable({ diff, exerciseNames }: { diff: DiffEntry[]; exerciseNames: Record<string, { name: string; category: string }> }) {
  const added = diff.filter((d) => d.change === "added");
  const removed = diff.filter((d) => d.change === "removed");
  const changed = diff.filter((d) => d.change === "changed");

  function exerciseLabel(id: string) {
    return exerciseNames[id]?.name ?? id;
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return <p style={{ opacity: 0.7 }}>No changes.</p>;
  }

  return (
    <div>
      {added.length > 0 && (
        <p>
          <strong style={{ color: "var(--viz-status-good, #0ca30c)" }}>+ Added:</strong>{" "}
          {added.map((d) => exerciseLabel(d.exerciseId)).join(", ")}
        </p>
      )}
      {removed.length > 0 && (
        <p>
          <strong style={{ color: "var(--viz-status-critical, #d03b3b)" }}>− Removed:</strong>{" "}
          {removed.map((d) => exerciseLabel(d.exerciseId)).join(", ")}
        </p>
      )}
      {changed.length > 0 && (
        <div>
          <strong>~ Changed:</strong>
          <ul>
            {changed.map((d) => (
              <li key={d.exerciseId}>
                {exerciseLabel(d.exerciseId)} — {d.changedFields?.join(", ")} ({JSON.stringify(d.before)} →{" "}
                {JSON.stringify(d.after)})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CycleCard({ cycle }: { cycle: Cycle }) {
  const [showTrace, setShowTrace] = useState(false);
  const [diffMode, setDiffMode] = useState<"previous" | "original">("previous");
  const result = cycle.resultJson as { riskTier?: string; decision?: string; rationale?: string; error?: string } | null;
  const cost = cycleCost(cycle);
  const diff = diffMode === "previous" ? cycle.diffFromPrevious : cycle.diffFromOriginal;

  return (
    <div style={cardStyle}>
      <p>
        <strong>
          Cycle {cycle.cycleIndex} — {cycle.flow === "FLOW_A_DRAFT" ? "Flow A" : "Flow B"}
        </strong>{" "}
        — {cycle.model} — <span>{cycle.status}</span> — {costLabel(cost)}
      </p>
      {result?.error && (
        <p role="alert" className="banner banner-error">
          {result.error}
        </p>
      )}
      {result?.decision && (
        <p>
          <strong>Decision: {result.decision}</strong>
          <br />
          {result.rationale}
        </p>
      )}
      {result?.riskTier && <p>Risk tier: {result.riskTier}</p>}

      {cycle.cycleIndex !== null && cycle.cycleIndex > 0 && (
        <div>
          <div style={rowStyle}>
            <strong>Changes:</strong>
            <label>
              <input
                type="radio"
                checked={diffMode === "previous"}
                onChange={() => setDiffMode("previous")}
              />{" "}
              vs. previous cycle
            </label>
            <label>
              <input
                type="radio"
                checked={diffMode === "original"}
                onChange={() => setDiffMode("original")}
              />{" "}
              vs. original (cycle 0)
            </label>
          </div>
          {diff ? <DiffTable diff={diff} exerciseNames={cycle.exerciseNames} /> : <p style={{ opacity: 0.7 }}>No diff available.</p>}
        </div>
      )}

      <button type="button" onClick={() => setShowTrace((v) => !v)} style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
        {showTrace ? "Hide" : "Show"} trace ({cycle.llmCalls.length} call{cycle.llmCalls.length === 1 ? "" : "s"})
      </button>
      {showTrace && (
        <div>
          {cycle.llmCalls.map((call) => (
            <div key={call.id} style={{ ...cardStyle, marginTop: "0.5rem" }}>
              <p>
                #{call.sequenceIndex} — {call.model} — {call.inputTokens}/{call.outputTokens} tok —{" "}
                {call.latencyMs}ms — {costLabel(call.costUsd)}
              </p>
              <details>
                <summary>Raw request / response</summary>
                <pre style={preStyle}>{JSON.stringify(call.requestJson, null, 2)}</pre>
                {call.responseJson !== null && <pre style={preStyle}>{JSON.stringify(call.responseJson, null, 2)}</pre>}
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunNextCyclePanel({ scenarioId, canRun }: { scenarioId: string; canRun: boolean }) {
  const queryClient = useQueryClient();
  const modelsQuery = useQuery({
    queryKey: qk.adminModels(),
    queryFn: async () => unwrap(await api.GET("/admin/experiments/models")),
  });
  const [painPattern, setPainPattern] = useState<"IMPROVING" | "PLATEAUING" | "WORSENING" | "CONTRADICTORY">("PLATEAUING");
  const [days, setDays] = useState(7);
  const [model, setModel] = useState("");

  const runNextCycle = useMutation({
    mutationFn: async (input: { painPattern: typeof painPattern; days: number; model: string }) =>
      unwrap(
        await api.POST("/admin/experiments/scenarios/{id}/next-cycle", {
          params: { path: { id: scenarioId } },
          body: input,
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.adminScenario(scenarioId) }),
  });

  const models = modelsQuery.data ?? [];

  return (
    <div style={cardStyle}>
      <h3>Run next cycle</h3>
      {!canRun && <p style={{ opacity: 0.7 }}>Can't continue — the latest cycle isn't VALID.</p>}
      <div style={rowStyle}>
        <label>
          Pain pattern{" "}
          <select value={painPattern} onChange={(e) => setPainPattern(e.target.value as typeof painPattern)}>
            <option value="IMPROVING">Improving</option>
            <option value="PLATEAUING">Plateauing</option>
            <option value="WORSENING">Worsening</option>
            <option value="CONTRADICTORY">Contradictory</option>
          </select>
        </label>
        <label>
          Days{" "}
          <input
            type="number"
            min={3}
            max={21}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 60 }}
          />
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
          disabled={!canRun || !model || runNextCycle.isPending}
          onClick={() => runNextCycle.mutate({ painPattern, days, model })}
        >
          {runNextCycle.isPending ? (
            <>
              <span className="spinner" aria-hidden="true" /> Running…
            </>
          ) : (
            "Run next cycle"
          )}
        </button>
      </div>
      {runNextCycle.isError && (
        <p role="alert" className="banner banner-error">
          {runNextCycle.error.message}
        </p>
      )}
    </div>
  );
}

export default function ScenarioDetailPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = use(params);
  const detailQuery = useQuery({
    queryKey: qk.adminScenario(scenarioId),
    queryFn: async () => unwrap(await api.GET("/admin/experiments/scenarios/{id}", { params: { path: { id: scenarioId } } })),
  });

  if (detailQuery.isLoading) {
    return (
      <main style={pageStyle}>
        <p>
          <span className="spinner" aria-hidden="true" /> Loading scenario…
        </p>
      </main>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <main style={pageStyle}>
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load scenario: {detailQuery.error?.message}
        </p>
      </main>
    );
  }

  const { scenario, cycles, painTimeline } = detailQuery.data;
  const latestCycle = cycles[cycles.length - 1];
  const canRunNext = latestCycle?.status === "VALID";

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/admin/experiments/scenarios">← Back to Scenarios</Link>
      </p>
      <h1>{scenario.name}</h1>
      {scenario.description && <p style={{ opacity: 0.7 }}>{scenario.description}</p>}

      <section style={sectionStyle}>
        <PainTrendChart painTimeline={painTimeline} cycles={cycles} />
      </section>

      <section style={sectionStyle}>
        <CostBarChart cycles={cycles} />
      </section>

      <section style={sectionStyle}>
        <RunNextCyclePanel scenarioId={scenarioId} canRun={canRunNext} />
      </section>

      <section style={sectionStyle}>
        <h2>Cycles</h2>
        {cycles.map((cycle) => (
          <CycleCard key={cycle.id} cycle={cycle} />
        ))}
      </section>
    </main>
  );
}
