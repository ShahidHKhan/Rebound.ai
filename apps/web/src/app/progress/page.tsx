"use client";

import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@rebound/api";

import { trpc } from "@/lib/trpc/client";

type Summary = inferRouterOutputs<AppRouter>["progress"]["summary"];
type PainPoint = Summary["painTrend"][number];

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
const tileRowStyle: React.CSSProperties = { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" };
const tileStyle: React.CSSProperties = {
  flex: "1 1 140px",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
};
const tileValueStyle: React.CSSProperties = { fontSize: "1.75rem", fontWeight: 700 };
const tileLabelStyle: React.CSSProperties = { color: "#666", fontSize: "0.85rem" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" };
const thTdStyle: React.CSSProperties = { textAlign: "left", padding: "0.35rem 0.5rem", borderBottom: "1px solid #ddd" };

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div style={tileStyle}>
      <div style={tileValueStyle}>{value}</div>
      <div style={tileLabelStyle}>{label}</div>
    </div>
  );
}

// Pain trend — single-series line chart, form: change over time. Reuses the
// same validated .viz-root palette/scoping already established for the
// admin scenario simulator's chart (apps/web/src/app/globals.css) — one
// identity color for the line, gridlines 0/2/4/6/8/10, crosshair + tooltip
// per the dataviz skill's interaction spec for line charts, plus a table
// fallback (dataviz's accessibility pass).
function PainTrendChart({ painTrend }: { painTrend: PainPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (painTrend.length === 0) {
    return <p style={{ opacity: 0.7 }}>No pain check-ins logged yet — trend appears after your first daily log.</p>;
  }

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 24, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const n = painTrend.length;
  const x = (i: number) => padding.left + (n <= 1 ? 0 : (i / (n - 1)) * plotWidth);
  const y = (pain: number) => padding.top + plotHeight - (pain / 10) * plotHeight;

  const linePath = painTrend.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)},${y(p.painScore)}`).join(" ");
  const hovered = hoverIndex !== null ? painTrend[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * width;
    const i = n <= 1 ? 0 : Math.round(((relativeX - padding.left) / plotWidth) * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div className="viz-root">
      <h2>Pain trend (last 60 days)</h2>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", background: "var(--viz-surface)" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
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
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
            stroke="var(--viz-baseline)"
            strokeWidth={1}
          />

          <path d={linePath} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hovered && (
            <g>
              <line
                x1={x(hoverIndex!)}
                x2={x(hoverIndex!)}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke="var(--viz-text-muted)"
                strokeWidth={1}
              />
              <circle
                cx={x(hoverIndex!)}
                cy={y(hovered.painScore)}
                r={5}
                fill="var(--viz-series-1)"
                stroke="var(--viz-surface)"
                strokeWidth={2}
              />
            </g>
          )}
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
            <strong>{hovered.date}</strong> — pain {hovered.painScore}/10
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
              <th style={thTdStyle}>Date</th>
              <th style={thTdStyle}>Pain</th>
            </tr>
          </thead>
          <tbody>
            {painTrend.map((p) => (
              <tr key={p.date}>
                <td style={thTdStyle}>{p.date}</td>
                <td style={thTdStyle}>{p.painScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const summary = trpc.progress.summary.useQuery();

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/today" style={linkStyle}>
          ← Today
        </Link>
      </p>
      <h1>Progress</h1>
      <p style={{ color: "#666" }}>How you&apos;re doing, at a glance.</p>

      {summary.isLoading && (
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      )}

      {summary.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load your progress: {summary.error.message}
        </p>
      )}

      {summary.data && (
        <>
          <div style={tileRowStyle}>
            <StatTile
              value={summary.data.adherencePct === null ? "—" : `${summary.data.adherencePct}%`}
              label="Adherence"
            />
            <StatTile value={String(summary.data.weeksActive)} label="Weeks active" />
            <StatTile value={String(summary.data.streak)} label="Day streak" />
          </div>

          <section style={sectionStyle}>
            <PainTrendChart painTrend={summary.data.painTrend} />
          </section>

          <p>
            <Link href="/progress/streak" style={linkStyle}>
              See your streak calendar →
            </Link>
          </p>
          <p>
            <Link href="/progress/milestones" style={linkStyle}>
              See your milestones →
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
