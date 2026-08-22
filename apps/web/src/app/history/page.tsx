"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import { qk } from "@/lib/rest/query-keys";

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" };
const thTdStyle: React.CSSProperties = { textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "1px solid #ddd" };
// Caps the log at a fixed height instead of letting the page grow unbounded
// — header row stays pinned while scrolling, same pattern as
// admin/experiments' run-history/LLM-calls tables.
const scrollTableWrapperStyle: React.CSSProperties = {
  maxHeight: 480,
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

export default function HistoryPage() {
  const logsQuery = useQuery({
    queryKey: qk.sessionLogs(),
    queryFn: async () => unwrap(await api.GET("/session-logs")),
  });

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/today" style={linkStyle}>
          ← Back to Today
        </Link>
      </p>
      <h1>History</h1>
      <p style={{ color: "#666" }}>Your past daily check-ins — pain score, exertion, and flags over time.</p>
      <p>
        <Link href="/adjustments" style={linkStyle}>
          See adjustment history →
        </Link>
      </p>

      {logsQuery.isLoading && (
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      )}
      {logsQuery.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load your history: {logsQuery.error.message}
        </p>
      )}
      {logsQuery.data && logsQuery.data.length === 0 && <p>No check-ins logged yet.</p>}
      {logsQuery.data && logsQuery.data.length > 0 && (
        <div style={scrollTableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={stickyThStyle}>Date</th>
                <th style={stickyThStyle}>Pain (0-10)</th>
                <th style={stickyThStyle}>Perceived exertion</th>
                <th style={stickyThStyle}>Made it worse?</th>
                <th style={stickyThStyle}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.data.map((log) => (
                <tr key={log.id}>
                  <td style={thTdStyle}>{new Date(log.loggedAt).toLocaleString()}</td>
                  <td style={thTdStyle}>{log.painScore}</td>
                  <td style={thTdStyle}>{log.perceivedExertion ?? "—"}</td>
                  <td style={thTdStyle}>{log.flag ? "Yes" : "No"}</td>
                  <td style={thTdStyle}>{log.completed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
