"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";

const pageStyle: React.CSSProperties = { maxWidth: 480, margin: "0 auto", padding: "2rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem" };

function minutesToTimeInput(minutes: number | null): string {
  if (minutes === null) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeInputToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function NotificationSettingsPage() {
  const current = trpc.user.getNotificationTimes.useQuery();

  // Same 7am/6pm fallback regime.activate uses when these are unset.
  const [wakeTime, setWakeTime] = useState("07:00");
  const [eveningTime, setEveningTime] = useState("18:00");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!current.data) return;
    setWakeTime(minutesToTimeInput(current.data.wakeTimeMinutes) || "07:00");
    setEveningTime(minutesToTimeInput(current.data.eveningTimeMinutes) || "18:00");
  }, [current.data]);

  const update = trpc.user.updateNotificationTimes.useMutation({
    onSuccess: () => setSaved(true),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    update.mutate({
      wakeTimeMinutes: timeInputToMinutes(wakeTime),
      eveningTimeMinutes: timeInputToMinutes(eveningTime),
    });
  }

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/settings" style={linkStyle}>
          ← Settings
        </Link>
      </p>
      <h1>Notification times</h1>
      <p style={{ color: "#666" }}>
        These control when your morning and evening session reminders fire. Changes apply going forward.
      </p>

      {current.isLoading && (
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      )}

      {current.isError && (
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load your current times: {current.error.message}
        </p>
      )}

      {!current.isLoading && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={fieldStyle}>
            Morning wake time
            <input type="time" required value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
          </label>

          <label style={fieldStyle}>
            Evening session time
            <input type="time" required value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} />
          </label>

          <button type="submit" disabled={update.isPending}>
            {update.isPending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </button>

          {saved && !update.isPending && <p className="banner banner-success">✓ Saved.</p>}
          {update.isError && (
            <p role="alert" className="banner banner-error">
              {update.error.message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
