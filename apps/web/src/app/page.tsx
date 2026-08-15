"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@rebound/api";

import { trpc } from "@/lib/trpc/client";

type TodayData = inferRouterOutputs<AppRouter>["workoutSession"]["today"];
type SessionSlot = "MORNING" | "EVENING";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

function SessionCard({
  slot,
  label,
  data,
  onComplete,
  completing,
}: {
  slot: SessionSlot;
  label: string;
  data: TodayData;
  onComplete: (workoutSessionId: string) => void;
  completing: boolean;
}) {
  if (!data.regime) return null;

  const session = data.sessions.find((s) => s.slot === slot);
  const exercises = data.regime.exerciseList.filter((e) => e.sessionSlot === slot);

  return (
    <div style={cardStyle}>
      <h2>{label}</h2>
      <ul>
        {exercises.map((e) => (
          <li key={e.exerciseId}>
            {e.exercise.name}
            {e.sets && e.reps ? ` — ${e.sets}×${e.reps}` : ""}
            {e.durationSeconds ? ` — ${e.durationSeconds}s` : ""}
          </li>
        ))}
      </ul>
      {session?.completedAt ? (
        <p>Completed at {session.completedAt.toLocaleTimeString()}</p>
      ) : (
        <button type="button" disabled={completing || !session} onClick={() => session && onComplete(session.id)}>
          Mark session complete
        </button>
      )}
    </div>
  );
}

function DeleteAccountSection() {
  const { signOut } = useClerk();
  const [confirming, setConfirming] = useState(false);

  const deleteAccount = trpc.user.deleteMyAccount.useMutation({
    onSuccess: () => signOut({ redirectUrl: "/" }),
  });

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} style={{ color: "#b91c1c" }}>
        Delete my account
      </button>
    );
  }

  return (
    <div>
      <p role="alert">
        This permanently deletes your account, regimes, and session history. This can&apos;t be undone.
      </p>
      <button
        type="button"
        disabled={deleteAccount.isPending}
        onClick={() => deleteAccount.mutate()}
        style={{ color: "#b91c1c" }}
      >
        {deleteAccount.isPending ? "Deleting…" : "Yes, permanently delete my account"}
      </button>{" "}
      <button type="button" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {deleteAccount.isError && <p role="alert">{deleteAccount.error.message}</p>}
    </div>
  );
}

export default function Home() {
  const utils = trpc.useUtils();
  const today = trpc.workoutSession.today.useQuery();

  const completeSession = trpc.workoutSession.complete.useMutation({
    onSuccess: () => utils.workoutSession.today.invalidate(),
  });

  const [painScore, setPainScore] = useState(0);
  const [madeItWorse, setMadeItWorse] = useState(false);
  const [perceivedExertion, setPerceivedExertion] = useState("");
  const [logResult, setLogResult] = useState<{ action: string; reasons: string[] } | null>(null);

  const logSession = trpc.sessionLog.create.useMutation({
    onSuccess: (result) => {
      setLogResult({ action: result.escalation.action, reasons: result.escalation.reasons });
      utils.workoutSession.today.invalidate();
    },
  });

  if (today.isLoading) {
    return (
      <main style={pageStyle}>
        <p>Loading…</p>
      </main>
    );
  }

  if (today.isError) {
    return (
      <main style={pageStyle}>
        <p role="alert">Couldn&apos;t load today&apos;s sessions: {today.error.message}</p>
      </main>
    );
  }

  if (!today.data?.regime) {
    return (
      <main style={pageStyle}>
        <h1>Rebound.ai</h1>
        <p>You don&apos;t have an active regime yet.</p>
        <p>
          <Link href="/onboarding" style={linkStyle}>
            Start onboarding →
          </Link>
        </p>
        <DeleteAccountSection />
      </main>
    );
  }

  const data = today.data;

  return (
    <main style={pageStyle}>
      <h1>Today</h1>
      <p style={{ color: "#666" }}>Regime v{data.regime.versionNumber}</p>
      <p>{data.streak > 0 ? `${data.streak}-day streak` : "No streak yet — complete a session to start one"}</p>

      <SessionCard
        slot="MORNING"
        label="Morning"
        data={data}
        completing={completeSession.isPending}
        onComplete={(id) => completeSession.mutate({ workoutSessionId: id })}
      />
      <SessionCard
        slot="EVENING"
        label="Evening"
        data={data}
        completing={completeSession.isPending}
        onComplete={(id) => completeSession.mutate({ workoutSessionId: id })}
      />

      <div style={cardStyle}>
        <h2>Daily check-in</h2>
        {data.todaysLog || logResult ? (
          <>
            <p>You&apos;ve already logged today.</p>
            {logResult?.action === "rollback" && (
              <p role="alert">
                <strong>Stop &amp; consult a professional.</strong> Your regime has been rolled back based on
                today&apos;s log. {logResult.reasons.join(" ")}
              </p>
            )}
            {(logResult?.action === "hold" || logResult?.action === "flag_for_review") && (
              <p>We&apos;re keeping a closer eye on your recent trend. {logResult.reasons.join(" ")}</p>
            )}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              logSession.mutate({
                painScore,
                flag: madeItWorse,
                perceivedExertion: perceivedExertion === "" ? undefined : Number(perceivedExertion),
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <label>
              Pain (0 = none, 10 = worst)
              <input
                type="number"
                min={0}
                max={10}
                required
                value={painScore}
                onChange={(e) => setPainScore(Number(e.target.value))}
              />
            </label>
            <label>
              <input type="checkbox" checked={madeItWorse} onChange={(e) => setMadeItWorse(e.target.checked)} />{" "}
              This made it worse
            </label>
            <label>
              Perceived exertion (optional, 0-10)
              <input
                type="number"
                min={0}
                max={10}
                value={perceivedExertion}
                onChange={(e) => setPerceivedExertion(e.target.value)}
              />
            </label>
            <button type="submit" disabled={logSession.isPending}>
              {logSession.isPending ? "Logging…" : "Log today"}
            </button>
            {logSession.isError && <p role="alert">{logSession.error.message}</p>}
          </form>
        )}
      </div>

      <DeleteAccountSection />
    </main>
  );
}
