"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@rebound/api";

import { trpc } from "@/lib/trpc/client";

type RegimeData = inferRouterOutputs<AppRouter>["regime"]["getById"];
type SessionSlot = "MORNING" | "EVENING";

interface EditableExercise {
  exerciseId: string;
  name: string;
  category: string;
  sets: number | undefined;
  reps: number | undefined;
  durationSeconds: number | undefined;
  frequency: string | undefined;
  sessionSlot: SessionSlot;
}

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "0.75rem",
};
const rowStyle: React.CSSProperties = { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" };
const numberInputStyle: React.CSSProperties = { width: 70 };

// Only what regime.activate's exerciseEditSchema needs — used to detect
// whether the user actually changed anything before sending an edited list.
function toComparablePayload(exercises: EditableExercise[]) {
  return exercises.map(({ exerciseId, sets, reps, durationSeconds, frequency, sessionSlot }) => ({
    exerciseId,
    sets,
    reps,
    durationSeconds,
    frequency,
    sessionSlot,
  }));
}

function toEditable(data: RegimeData): EditableExercise[] {
  return data.exerciseList.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.exercise.name,
    category: e.exercise.category,
    sets: e.sets ?? undefined,
    reps: e.reps ?? undefined,
    durationSeconds: e.durationSeconds ?? undefined,
    frequency: e.frequency ?? undefined,
    sessionSlot: e.sessionSlot,
  }));
}

export function RegimeReview({ regimeId }: { regimeId: string }) {
  const regimeQuery = trpc.regime.getById.useQuery({ regimeId });
  const [exercises, setExercises] = useState<EditableExercise[] | null>(null);
  const [activated, setActivated] = useState<{ exerciseCount: number } | null>(null);
  // Tracks which query result we've already seeded local edit state from —
  // set during render (not an effect) per React's "adjusting state when a
  // prop changes" pattern, avoiding a cascading-render round trip.
  const [seededFrom, setSeededFrom] = useState<typeof regimeQuery.data>(undefined);

  if (regimeQuery.data && regimeQuery.data !== seededFrom) {
    setSeededFrom(regimeQuery.data);
    setExercises(toEditable(regimeQuery.data));
  }

  const activate = trpc.regime.activate.useMutation({
    onSuccess: (result) => setActivated(result),
  });

  function updateExercise(exerciseId: string, patch: Partial<EditableExercise>) {
    setExercises((prev) => prev?.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e)) ?? null);
  }

  function handleActivate() {
    if (!exercises || !regimeQuery.data) return;

    const original = toComparablePayload(toEditable(regimeQuery.data));
    const current = toComparablePayload(exercises);
    const changed = JSON.stringify(original) !== JSON.stringify(current);

    activate.mutate({
      regimeId,
      exercises: changed ? current : undefined,
    });
  }

  if (activated) {
    return (
      <main style={pageStyle}>
        <h1>Regime activated</h1>
        <p>
          {activated.exerciseCount} exercises are now live, split across your morning and evening sessions.
        </p>
        <p>(Daily check-in screen is next up — Task 4.)</p>
      </main>
    );
  }

  if (regimeQuery.isLoading || !exercises) {
    return (
      <main style={pageStyle}>
        <p>Loading regime…</p>
      </main>
    );
  }

  if (regimeQuery.isError) {
    return (
      <main style={pageStyle}>
        <p role="alert">Couldn&apos;t load this regime: {regimeQuery.error.message}</p>
      </main>
    );
  }

  const morning = exercises.filter((e) => e.sessionSlot === "MORNING");
  const evening = exercises.filter((e) => e.sessionSlot === "EVENING");

  return (
    <main style={pageStyle}>
      <h1>Review your regime</h1>
      <p>Adjust sets, reps, duration, frequency, or which session an exercise falls in, then activate.</p>

      {([
        ["Morning", morning],
        ["Evening", evening],
      ] as const).map(([label, group]) => (
        <section key={label}>
          <h2>{label}</h2>
          {group.length === 0 && <p>No exercises assigned.</p>}
          {group.map((exercise) => (
            <div key={exercise.exerciseId} style={cardStyle}>
              <strong>{exercise.name}</strong> <span>({exercise.category.toLowerCase()})</span>
              <div style={rowStyle}>
                <label>
                  Sets{" "}
                  <input
                    style={numberInputStyle}
                    type="number"
                    min={1}
                    max={10}
                    value={exercise.sets ?? ""}
                    onChange={(e) =>
                      updateExercise(exercise.exerciseId, {
                        sets: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Reps{" "}
                  <input
                    style={numberInputStyle}
                    type="number"
                    min={1}
                    max={50}
                    value={exercise.reps ?? ""}
                    onChange={(e) =>
                      updateExercise(exercise.exerciseId, {
                        reps: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Duration (s){" "}
                  <input
                    style={numberInputStyle}
                    type="number"
                    min={5}
                    max={1800}
                    value={exercise.durationSeconds ?? ""}
                    onChange={(e) =>
                      updateExercise(exercise.exerciseId, {
                        durationSeconds: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Frequency{" "}
                  <input
                    type="text"
                    maxLength={50}
                    value={exercise.frequency ?? ""}
                    onChange={(e) => updateExercise(exercise.exerciseId, { frequency: e.target.value || undefined })}
                  />
                </label>
                <label>
                  Slot{" "}
                  <select
                    value={exercise.sessionSlot}
                    onChange={(e) =>
                      updateExercise(exercise.exerciseId, { sessionSlot: e.target.value as SessionSlot })
                    }
                  >
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </section>
      ))}

      <button type="button" onClick={handleActivate} disabled={activate.isPending}>
        {activate.isPending ? "Activating…" : "Activate regime"}
      </button>

      {activate.isError && <p role="alert">{activate.error.message}</p>}
    </main>
  );
}
