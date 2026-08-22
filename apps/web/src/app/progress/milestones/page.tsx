"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import { qk } from "@/lib/rest/query-keys";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
};

export default function MilestonesPage() {
  const milestones = useQuery({
    queryKey: qk.milestones(),
    queryFn: async () => unwrap(await api.GET("/progress/milestones")),
  });

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/progress" style={linkStyle}>
          ← Progress
        </Link>
      </p>
      <h1>Milestones</h1>
      <p style={{ color: "#666" }}>Achievements based on your activity so far — nothing to unlock or buy.</p>

      {milestones.isLoading && (
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      )}

      {milestones.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load your milestones: {milestones.error.message}
        </p>
      )}

      {milestones.data && milestones.data.length === 0 && (
        <p style={{ opacity: 0.7 }}>No milestones yet — keep going, your first one is close.</p>
      )}

      {milestones.data?.map((m) => (
        <div key={m.id} style={cardStyle}>
          <strong>🏅 {m.label}</strong>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>{m.description}</p>
        </div>
      ))}
    </main>
  );
}
