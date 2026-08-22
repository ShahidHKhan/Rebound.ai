"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import { qk } from "@/lib/rest/query-keys";
import type { components } from "@/lib/rest/schema";

type TodayData = components["schemas"]["WorkoutSessionToday"];
type Slot = "MORNING" | "EVENING";
type RegimeExerciseItem = NonNullable<TodayData["regime"]>["exerciseList"][number];

// Client-side default — v1 has no per-exercise rest duration authored by
// Flow A/B (that would need LLM prompt + clinical-rules changes, out of
// scope here). Advisory only: it never blocks "Complete set"/"Next".
const REST_SECONDS = 30;

const pageStyle: React.CSSProperties = { display: "flex", flexDirection: "column", height: "100vh" };
const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 1.5rem",
  borderBottom: "1px solid #eee",
};
// Core-CSS scroll-snap, no library — matches the mobile build's core-RN
// FlatList paging choice: swipe/trackpad-scroll works natively, and the
// Back/Next buttons + arrow keys below drive the identical scrollTo call,
// so keyboard-only users get a real single-point equivalent (WCAG 2.5.1),
// not just a swipe-only interaction.
const trackStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  overflowX: "auto",
  scrollSnapType: "x mandatory",
};
const cardWrapStyle: React.CSSProperties = {
  flex: "0 0 100%",
  scrollSnapAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1.5rem",
  width: "100%",
  maxWidth: 420,
};
const exitStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "1.25rem",
  background: "none",
  border: "none",
  minWidth: 44,
  minHeight: 44,
};

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GuidedSession({ slot }: { slot: Slot }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = useQuery({
    queryKey: qk.workoutSessionsToday(),
    queryFn: async () => unwrap(await api.GET("/workout-sessions/today")),
  });

  const [cardIndex, setCardIndex] = useState(0);
  const [setsCompleted, setSetsCompleted] = useState<Record<string, number>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => Date.now());

  // Single ticking clock drives both the elapsed-time header and the rest
  // countdown — one interval, not two.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const exercises: RegimeExerciseItem[] = useMemo(() => {
    if (!today.data?.regime) return [];
    return today.data.regime.exerciseList.filter((e) => e.sessionSlot === slot);
  }, [today.data, slot]);

  const workoutSession = today.data?.sessions.find((s) => s.slot === slot);

  const completeSession = useMutation({
    mutationFn: async (durationSeconds: number) =>
      unwrap(
        await api.POST("/workout-sessions/{id}/complete", {
          params: { path: { id: workoutSession!.id } },
          body: { durationSeconds },
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.workoutSessionsToday() });
      router.replace("/today");
    },
  });

  function goToIndex(index: number) {
    const clamped = Math.max(0, Math.min(index, exercises.length));
    const el = trackRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setCardIndex(clamped);
  }

  // Detects a settled scroll position after a native swipe/trackpad drag
  // (not triggered by goToIndex's own buttons/arrow-keys, which already set
  // state directly) — debounced so mid-scroll positions don't flicker cardIndex.
  function onScroll() {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      setCardIndex(Math.round(el.scrollLeft / el.clientWidth));
    }, 120);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goToIndex(cardIndex + 1);
      if (e.key === "ArrowLeft") goToIndex(cardIndex - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex, exercises.length]);

  function completeSet(regimeExerciseId: string, totalSets: number) {
    setSetsCompleted((prev) => {
      const next = (prev[regimeExerciseId] ?? 0) + 1;
      if (next < totalSets) setRestEndsAt(Date.now() + REST_SECONDS * 1000);
      else setRestEndsAt(null);
      return { ...prev, [regimeExerciseId]: next };
    });
  }

  if (today.isLoading) {
    return (
      <main style={pageStyle}>
        <p style={{ padding: "2rem" }}>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      </main>
    );
  }

  if (today.isError || !today.data?.regime || !workoutSession || exercises.length === 0) {
    return (
      <main style={pageStyle}>
        <p role="alert" className="banner banner-error" style={{ margin: "2rem" }}>
          Couldn&apos;t start this session.
        </p>
        <button type="button" onClick={() => router.back()} style={{ margin: "0 2rem", alignSelf: "flex-start" }}>
          ‹ Back
        </button>
      </main>
    );
  }

  const elapsedSeconds = Math.floor((now - startedAt) / 1000);
  // Derived directly from now/restEndsAt rather than cleared via a separate
  // effect — an expired timer here reads as "no rest showing" on its own,
  // no extra setState-in-effect indirection needed.
  const restSecondsLeft = restEndsAt !== null && now < restEndsAt ? Math.ceil((restEndsAt - now) / 1000) : null;
  const isSummary = cardIndex >= exercises.length;

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          style={exitStyle}
          aria-label="Exit session"
        >
          ✕
        </button>
        <strong>{isSummary ? "Summary" : `Exercise ${cardIndex + 1} of ${exercises.length}`}</strong>
        <span>{formatClock(elapsedSeconds)}</span>
      </div>

      <div ref={trackRef} style={trackStyle} onScroll={onScroll}>
        {exercises.map((e, i) => {
          const completed = setsCompleted[e.id] ?? 0;
          const totalSets = e.sets ?? 1;
          const setDone = completed >= totalSets;
          const isDurationBased = Boolean(e.durationSeconds);

          return (
            <div key={e.id} style={cardWrapStyle}>
              <div style={cardStyle}>
                <h2>{e.exercise.name}</h2>
                <p>
                  Set {Math.min(completed + 1, totalSets)} of {totalSets}
                </p>
                <p style={{ color: "#666" }}>
                  {isDurationBased ? `Hold for ${e.durationSeconds}s` : e.reps ? `${e.reps} reps` : ""}
                </p>

                <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "0.75rem 0" }}>
                  {Array.from({ length: totalSets }).map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: dotIdx < completed ? "#2563eb" : "#e5e7eb",
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>

                {setDone ? (
                  <button type="button" onClick={() => goToIndex(i + 1)} style={{ width: "100%" }}>
                    Next exercise →
                  </button>
                ) : (
                  <button type="button" onClick={() => completeSet(e.id, totalSets)} style={{ width: "100%" }}>
                    Complete set
                  </button>
                )}

                {restSecondsLeft !== null && restSecondsLeft > 0 && (
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}
                  >
                    <span>⏱ Rest {formatClock(restSecondsLeft)}</span>
                    <button type="button" onClick={() => setRestEndsAt(null)}>
                      Skip
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
                  <button type="button" disabled={i === 0} onClick={() => goToIndex(i - 1)}>
                    ‹ Back
                  </button>
                  <button type="button" onClick={() => goToIndex(i + 1)}>
                    {setDone ? "Next ›" : "Skip ›"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <div style={cardWrapStyle}>
          <div style={cardStyle}>
            <h2>Session complete</h2>
            <p>
              {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · {formatClock(elapsedSeconds)}
            </p>
            <button
              type="button"
              disabled={completeSession.isPending}
              onClick={() => completeSession.mutate(elapsedSeconds)}
              style={{ width: "100%", marginTop: "0.75rem" }}
            >
              {completeSession.isPending ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Finishing…
                </>
              ) : (
                "Finish session"
              )}
            </button>
            {completeSession.isError && (
              <p role="alert" className="banner banner-error" style={{ marginTop: "0.75rem" }}>
                {completeSession.error.message}
              </p>
            )}
            <button type="button" onClick={() => goToIndex(exercises.length - 1)} style={{ marginTop: "0.75rem" }}>
              ‹ Back
            </button>
          </div>
        </div>
      </div>

      <dialog ref={dialogRef} className="confirm-modal">
        <p role="alert" style={{ marginBottom: "1rem" }}>
          Your progress on this session won&apos;t be saved.
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={() => router.back()}>
            Leave session
          </button>
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Keep going
          </button>
        </div>
      </dialog>
    </main>
  );
}
