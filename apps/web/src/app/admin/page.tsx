"use client";

import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@rebound/api";

import { trpc } from "@/lib/trpc/client";

type FlaggedUser = inferRouterOutputs<AppRouter>["admin"]["flaggedUsers"][number];

const pageStyle: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
};
const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };

function FlaggedUserRow({ entry }: { entry: FlaggedUser }) {
  const utils = trpc.useUtils();
  const [reason, setReason] = useState(entry.user.manualHoldReason ?? "");

  const setManualHold = trpc.admin.setManualHold.useMutation({
    onSuccess: () => utils.admin.flaggedUsers.invalidate(),
  });

  return (
    <div style={cardStyle}>
      <p>
        <strong>{entry.user.id}</strong> — risk tier: {entry.user.riskTier}
      </p>
      <p>Flags: {entry.reasons.join(", ")}</p>
      <p>Most recent: {entry.mostRecent.toLocaleString()}</p>
      <p>
        Manual hold: <strong>{entry.user.manualHold ? "ON" : "off"}</strong>
        {entry.user.manualHold && entry.user.manualHoldReason ? ` — ${entry.user.manualHoldReason}` : ""}
      </p>

      {entry.user.manualHold ? (
        <button
          type="button"
          disabled={setManualHold.isPending}
          onClick={() => setManualHold.mutate({ userId: entry.user.id, manualHold: false })}
        >
          Release hold
        </button>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <button
            type="button"
            disabled={setManualHold.isPending || !reason.trim()}
            onClick={() => setManualHold.mutate({ userId: entry.user.id, manualHold: true, reason })}
          >
            Put on manual hold
          </button>
        </div>
      )}

      {setManualHold.isError && <p role="alert">{setManualHold.error.message}</p>}
    </div>
  );
}

export default function AdminPage() {
  const metrics = trpc.admin.metrics.useQuery();
  const flaggedUsers = trpc.admin.flaggedUsers.useQuery();

  if (metrics.isError || flaggedUsers.isError) {
    return (
      <main style={pageStyle}>
        <h1>Admin</h1>
        <p role="alert">
          You don&apos;t have admin access, or something went wrong: {(metrics.error ?? flaggedUsers.error)?.message}
        </p>
      </main>
    );
  }

  if (!metrics.data || !flaggedUsers.data) {
    return (
      <main style={pageStyle}>
        <p>Loading…</p>
      </main>
    );
  }

  const m = metrics.data;
  const users = flaggedUsers.data;

  return (
    <main style={pageStyle}>
      <h1>Admin</h1>

      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Link href="/admin/experiments">Flow experimentation →</Link>
        <Link href="/admin/experiments/scenarios">Scenarios →</Link>
      </nav>

      <section style={sectionStyle}>
        <h2>Metrics</h2>
        <div style={cardStyle}>
          <h3>Activation funnel</h3>
          <p>Total users: {m.activationFunnel.totalUsers}</p>
          <p>Regime generated: {m.activationFunnel.regimeGenerated}</p>
          <p>Regime activated: {m.activationFunnel.regimeActivated}</p>
          <p>Logged at least once: {m.activationFunnel.loggedAtLeastOnce}</p>
        </div>
        <div style={cardStyle}>
          <h3>Adverse events</h3>
          <p>Flagged session logs (&quot;made it worse&quot;): {m.adverseEvents.flaggedSessionLogs}</p>
          <p>Escalation rollbacks: {m.adverseEvents.escalationRollbacks}</p>
        </div>
        <div style={cardStyle}>
          <h3>Flow A / Flow B failures</h3>
          <p>
            Flow A jobs failed: {m.flowFailures.flowAJobsFailed} / {m.flowFailures.flowAJobsTotal}
          </p>
          <p>
            Flow B holds: {m.flowFailures.flowBScheduledHolds} / {m.flowFailures.flowBScheduledAdjustments}
          </p>
        </div>
        <div style={cardStyle}>
          <h3>Reversal rate</h3>
          <p>
            {m.reversalRate.markedReversed} / {m.reversalRate.totalAdjustmentEvents}
          </p>
          <p style={{ fontStyle: "italic" }}>{m.reversalRate.note}</p>
        </div>
      </section>

      <section>
        <h2>Flagged users</h2>
        {users.length === 0 && <p>No flagged users right now.</p>}
        {users.map((entry) => (
          <FlaggedUserRow key={entry.user.id} entry={entry} />
        ))}
      </section>
    </main>
  );
}
