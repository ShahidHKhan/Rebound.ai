"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import { qk } from "@/lib/rest/query-keys";

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
};

const TRIGGER_LABEL: Record<string, string> = {
  SCHEDULED_ADJUSTMENT: "Scheduled adjustment",
  ESCALATION_ROLLBACK: "Escalation rollback",
};

export default function AdjustmentsPage() {
  const eventsQuery = useQuery({
    queryKey: qk.adjustmentEvents(),
    queryFn: async () => unwrap(await api.GET("/adjustment-events")),
  });

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/today" style={linkStyle}>
          ← Back to Today
        </Link>
      </p>
      <h1>Adjustment history</h1>
      <p style={{ color: "#666" }}>
        Every time your plan changed — whether from a scheduled weekly review or a safety rollback — and why.
      </p>

      {eventsQuery.isLoading && (
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      )}
      {eventsQuery.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load your adjustment history: {eventsQuery.error.message}
        </p>
      )}
      {eventsQuery.data && eventsQuery.data.length === 0 && (
        <p>No adjustments yet — your plan hasn&apos;t changed since it was created.</p>
      )}
      {eventsQuery.data?.map((event) => (
        <div key={event.id} style={cardStyle}>
          <p>
            <strong>
              v{event.fromRegime.versionNumber} → v{event.toRegime.versionNumber}
            </strong>{" "}
            — {TRIGGER_LABEL[event.triggerType] ?? event.triggerType}
            {event.wasReversed && (
              <span className="banner banner-error" style={{ marginLeft: "0.5rem", padding: "0.1rem 0.5rem" }}>
                Later reversed
              </span>
            )}
          </p>
          <p style={{ color: "#666", fontSize: "0.85rem" }}>{new Date(event.triggeredAt).toLocaleString()}</p>
          <p style={{ marginTop: "0.4rem" }}>{event.rationale}</p>
        </div>
      ))}
    </main>
  );
}
