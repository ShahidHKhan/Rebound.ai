"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/client";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 6,
  marginTop: "1rem",
};
const weekdayLabelStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: "0.7rem",
  color: "#666",
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dayCellStyle(completed: boolean, isToday: boolean): React.CSSProperties {
  return {
    aspectRatio: "1 / 1",
    borderRadius: 6,
    border: isToday ? "2px solid #2563eb" : "1px solid #eee",
    background: completed ? "#2563eb" : "transparent",
  };
}

export default function StreakDetailPage() {
  const calendar = trpc.progress.streakCalendar.useQuery();
  const todayKey = new Date().toISOString().slice(0, 10);

  // Pad the front of the grid so the first real day lands on its correct
  // weekday column (days[0].date's UTC day-of-week).
  const leadingBlanks = calendar.data ? new Date(calendar.data.days[0].date).getUTCDay() : 0;

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/progress" style={linkStyle}>
          ← Progress
        </Link>
      </p>
      <h1>Streak calendar</h1>

      {calendar.isLoading && (
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      )}

      {calendar.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load your streak: {calendar.error.message}
        </p>
      )}

      {calendar.data && (
        <>
          <p>
            {calendar.data.streak > 0
              ? `${calendar.data.streak}-day streak`
              : "No streak yet — complete a session to start one"}
          </p>
          <p style={{ color: "#666", fontSize: "0.85rem" }}>
            A day counts if at least one session (morning or evening) was completed.
          </p>

          <div style={gridStyle}>
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} style={weekdayLabelStyle}>
                {label}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {calendar.data.days.map((day) => (
              <div
                key={day.date}
                title={`${day.date}${day.completed ? " — completed" : ""}`}
                style={dayCellStyle(day.completed, day.date === todayKey)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
