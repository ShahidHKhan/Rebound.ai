"use client";

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
  completeError,
}: {
  slot: SessionSlot;
  label: string;
  data: TodayData;
  onComplete: (workoutSessionId: string) => void;
  completing: boolean;
  completeError: string | null;
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
            <Link href={`/exercise/${e.exerciseId}`} style={linkStyle}>
              {e.exercise.name}
            </Link>
            {e.sets && e.reps ? ` — ${e.sets}×${e.reps}` : ""}
            {e.durationSeconds ? ` — ${e.durationSeconds}s` : ""}
          </li>
        ))}
      </ul>
      {session?.completedAt ? (
        <p>Completed at {session.completedAt.toLocaleTimeString()}</p>
      ) : (
        <>
          <button type="button" disabled={completing || !session} onClick={() => session && onComplete(session.id)}>
            {completing ? (
              <>
                <span className="spinner" aria-hidden="true" /> Completing…
              </>
            ) : (
              "Mark session complete"
            )}
          </button>
          {completeError && (
            <p role="alert" className="banner banner-error" style={{ marginTop: "0.5rem" }}>
              {completeError}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const TRIGGER_LABEL: Record<string, string> = {
  SCHEDULED_ADJUSTMENT: "Scheduled adjustment",
  ESCALATION_ROLLBACK: "Escalation rollback",
};

// Promotes the hold/rollback banner (transient, shown only right after a
// sessionLog.create call above) into a revisitable "what changed and why"
// moment — surfaced whenever the active regime isn't the original version.
function AdjustmentExplainer({ regimeId, versionNumber }: { regimeId: string; versionNumber: number }) {
  const eventsQuery = trpc.adjustmentEvent.list.useQuery();

  if (versionNumber <= 1) return null;
  if (!eventsQuery.data) return null;

  const latestEvent = eventsQuery.data.find((e) => e.toRegimeVersionId === regimeId);
  if (!latestEvent) return null;

  return (
    <div style={cardStyle}>
      <h2>Your plan changed</h2>
      <p>
        <strong>
          v{latestEvent.fromRegime.versionNumber} → v{latestEvent.toRegime.versionNumber}
        </strong>{" "}
        — {TRIGGER_LABEL[latestEvent.triggerType] ?? latestEvent.triggerType}
      </p>
      <p style={{ color: "#666", fontSize: "0.85rem" }}>{new Date(latestEvent.triggeredAt).toLocaleString()}</p>
      <p style={{ marginTop: "0.4rem" }}>{latestEvent.rationale}</p>
      <p style={{ marginTop: "0.5rem" }}>
        <Link href="/adjustments" style={linkStyle}>
          See full history →
        </Link>
      </p>
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
        <p>
          <span className="spinner" aria-hidden="true" /> Loading…
        </p>
      </main>
    );
  }

  if (today.isError) {
    return (
      <main style={pageStyle}>
        <p role="alert" className="banner banner-error">
          Couldn&apos;t load today&apos;s sessions: {today.error.message}
        </p>
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
      </main>
    );
  }

  const data = today.data;

  return (
    <main style={pageStyle}>
      <h1>Today</h1>
      <p style={{ color: "#666" }}>Regime v{data.regime.versionNumber}</p>
      <p>{data.streak > 0 ? `${data.streak}-day streak` : "No streak yet — complete a session to start one"}</p>

      <AdjustmentExplainer regimeId={data.regime.id} versionNumber={data.regime.versionNumber} />

      <SessionCard
        slot="MORNING"
        label="Morning"
        data={data}
        completing={completeSession.isPending}
        completeError={completeSession.isError ? completeSession.error.message : null}
        onComplete={(id) => completeSession.mutate({ workoutSessionId: id })}
      />
      <SessionCard
        slot="EVENING"
        label="Evening"
        data={data}
        completing={completeSession.isPending}
        completeError={completeSession.isError ? completeSession.error.message : null}
        onComplete={(id) => completeSession.mutate({ workoutSessionId: id })}
      />

      <div style={cardStyle}>
        <h2>Daily check-in</h2>
        {data.todaysLog || logResult ? (
          <>
            {logResult?.action === "rollback" ? (
              <p role="alert" className="banner banner-error">
                <strong>Stop &amp; consult a professional.</strong> Your regime has been rolled back based on
                today&apos;s log. {logResult.reasons.join(" ")}
              </p>
            ) : logResult?.action === "hold" || logResult?.action === "flag_for_review" ? (
              <p className="banner banner-error">
                We&apos;re keeping a closer eye on your recent trend. {logResult.reasons.join(" ")}
              </p>
            ) : logResult ? (
              <p className="banner banner-success">✓ Logged for today.</p>
            ) : (
              <p>You&apos;ve already logged today.</p>
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
              {logSession.isPending ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Logging…
                </>
              ) : (
                "Log today"
              )}
            </button>
            {logSession.isError && (
              <p role="alert" className="banner banner-error">
                {logSession.error.message}
              </p>
            )}
          </form>
        )}
      </div>

      <p>
        <Link href="/history" style={linkStyle}>
          History →
        </Link>
      </p>
      <p>
        <Link href="/progress" style={linkStyle}>
          Progress →
        </Link>
      </p>
      <p>
        <Link href="/settings" style={linkStyle}>
          Settings →
        </Link>
      </p>
    </main>
  );
}
