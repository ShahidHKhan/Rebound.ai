"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import type { paths } from "@/lib/rest/schema";

type OnboardingSubmitInput = NonNullable<paths["/onboarding"]["post"]["requestBody"]>["content"]["application/json"];

type GoalType = "INJURY_RECOVERY" | "STRENGTH" | "MOBILITY" | "GENERAL_FITNESS";
type InjurySeverity = "none" | "mild" | "moderate" | "severe";
type Equipment =
  | "BODY_ONLY"
  | "MACHINE"
  | "OTHER"
  | "FOAM_ROLL"
  | "KETTLEBELLS"
  | "DUMBBELL"
  | "CABLE"
  | "BARBELL"
  | "BANDS"
  | "MEDICINE_BALL"
  | "EXERCISE_BALL"
  | "EZ_CURL_BAR";

interface RedFlagAnswers {
  severeSuddenPain: boolean;
  numbnessOrTingling: boolean;
  recentTrauma: boolean;
  recentSurgery: boolean;
  pregnancyRelated: boolean;
  cardiacSymptomsWithExertion: boolean;
}

const initialRedFlags: RedFlagAnswers = {
  severeSuddenPain: false,
  numbnessOrTingling: false,
  recentTrauma: false,
  recentSurgery: false,
  pregnancyRelated: false,
  cardiacSymptomsWithExertion: false,
};

// Matches HEAVIER_CONDITION_FLAGS in packages/clinical-rules/src/risk-tiering.ts —
// "autoimmune" and "chronic" are the literal strings that route risk tiering,
// so these values must stay in sync with that set.
const CONDITION_FLAG_OPTIONS: { value: string; label: string }[] = [
  { value: "autoimmune", label: "Autoimmune condition" },
  { value: "chronic", label: "Chronic condition" },
  { value: "post_surgical", label: "Post-surgical (already cleared to exercise)" },
];

const RED_FLAG_QUESTIONS: { key: keyof RedFlagAnswers; label: string }[] = [
  { key: "severeSuddenPain", label: "Severe or sudden-onset pain" },
  { key: "numbnessOrTingling", label: "Numbness or tingling" },
  { key: "recentTrauma", label: "Recent trauma or injury" },
  { key: "recentSurgery", label: "Recent surgery you haven't been cleared from" },
  { key: "pregnancyRelated", label: "Pregnancy-related symptoms" },
  {
    key: "cardiacSymptomsWithExertion",
    label: "Chest pain, dizziness, or shortness of breath during exertion",
  },
];

// Not exhaustive of Equipment (skips OTHER/EZ_CURL_BAR) — these are the
// pieces a user would actually recognize and plausibly have at home for
// injury recovery / mobility / strength work, the three things this
// question exists for. BODY_ONLY is deliberately omitted from the list
// itself since it's always assumed available, not a pickable option.
const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: "BANDS", label: "Resistance bands" },
  { value: "DUMBBELL", label: "Dumbbells" },
  { value: "KETTLEBELLS", label: "Kettlebells" },
  { value: "BARBELL", label: "Barbell" },
  { value: "CABLE", label: "Cable machine" },
  { value: "MACHINE", label: "Gym machines" },
  { value: "FOAM_ROLL", label: "Foam roller" },
  { value: "EXERCISE_BALL", label: "Exercise/stability ball" },
  { value: "MEDICINE_BALL", label: "Medicine ball" },
];

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "GENERAL_FITNESS", label: "General fitness" },
  { value: "INJURY_RECOVERY", label: "Injury recovery" },
  { value: "STRENGTH", label: "Strength" },
  { value: "MOBILITY", label: "Mobility" },
];

const SEVERITY_OPTIONS: { value: InjurySeverity; label: string }[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

// "Building your plan" moment: cycled status copy shown while Flow A drafts
// the regime, wrapping the existing 2s-interval poll unchanged (see the
// jobStatus query below) — this only changes what's rendered while pending.
const BUILDING_MESSAGES = [
  "Reviewing your goals…",
  "Screening for safety…",
  "Drafting your first regime…",
];
const BUILDING_MESSAGE_INTERVAL_MS = 2200;

function BuildingPlanStatus() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % BUILDING_MESSAGES.length);
    }, BUILDING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <p style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span aria-live="polite">{BUILDING_MESSAGES[messageIndex]}</span>
    </p>
  );
}

const TOTAL_STEPS = 4;
const STEP_TITLES = [
  "What brings you here?",
  "Tell us about your training and health",
  "Any red flags?",
  "Review and submit",
];

const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem" };
const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const progressWrapStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.5rem" };
const progressDotsStyle: React.CSSProperties = { display: "flex", gap: "0.5rem" };
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%", backgroundColor: "#d1d5db" };
const dotActiveStyle: React.CSSProperties = { backgroundColor: "#2563eb" };
const progressTextStyle: React.CSSProperties = { fontSize: "0.875rem", color: "#4b5563", margin: 0 };
const navRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "1rem" };
const reviewRowStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.15rem" };
const reviewListStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.75rem" };

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div style={progressWrapStyle}>
      <div style={progressDotsStyle} aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <span key={n} style={{ ...dotStyle, ...(n <= step ? dotActiveStyle : {}) }} />
        ))}
      </div>
      <p style={progressTextStyle}>
        Step {step} of {TOTAL_STEPS}: {STEP_TITLES[step - 1]}
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);

  const [age, setAge] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("GENERAL_FITNESS");
  const [injurySeverity, setInjurySeverity] = useState<InjurySeverity>("none");
  const [conditionFlags, setConditionFlags] = useState<string[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagAnswers>(initialRedFlags);
  const [targetMovement, setTargetMovement] = useState("");
  const [symptomsText, setSymptomsText] = useState("");
  const [lifestyleContextText, setLifestyleContextText] = useState("");

  // Daily Session Structure: morning "on wake", evening at a user-picked
  // time — both optional, pre-filled to sensible defaults.
  const [wakeTime, setWakeTime] = useState("07:00");
  const [eveningTime, setEveningTime] = useState("18:00");

  const [jobId, setJobId] = useState<string | null>(null);
  const [redFlagReasons, setRedFlagReasons] = useState<string[] | null>(null);
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [cooldownRegimeCreatedAt, setCooldownRegimeCreatedAt] = useState<Date | null>(null);

  const submit = useMutation({
    mutationFn: async (input: OnboardingSubmitInput) => unwrap(await api.POST("/onboarding", { body: input })),
    onSuccess: (result) => {
      if (result.status === "crisis_detected") {
        setCrisisDetected(true);
      } else if (result.status === "red_flagged") {
        setRedFlagReasons(result.reasons);
      } else if (result.status === "cooldown_active") {
        setCooldownRegimeCreatedAt(new Date(result.regimeCreatedAt));
      } else {
        setJobId(result.jobId);
      }
    },
  });

  const jobStatus = useQuery({
    queryKey: ["onboarding", "jobs", jobId],
    queryFn: async () =>
      unwrap(await api.GET("/onboarding/jobs/{jobId}", { params: { path: { jobId: jobId ?? "" } } })),
    enabled: jobId !== null,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 2000 : false),
  });

  function toggleConditionFlag(value: string) {
    setConditionFlags((prev) => (prev.includes(value) ? prev.filter((flag) => flag !== value) : [...prev, value]));
  }

  function toggleEquipment(value: Equipment) {
    setAvailableEquipment((prev) => (prev.includes(value) ? prev.filter((eq) => eq !== value) : [...prev, value]));
  }

  // Advancing a step re-uses the browser's native constraint validation
  // (required/min/max/maxLength) against whatever fields are currently
  // mounted — same rules as before, just checked per-step instead of all at
  // once at the very end.
  function goNext() {
    if (formRef.current?.checkValidity()) {
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    } else {
      formRef.current?.reportValidity();
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const [wakeHours, wakeMinutes] = wakeTime.split(":").map(Number);
    const [eveningHours, eveningMinutes] = eveningTime.split(":").map(Number);
    submit.mutate({
      answers: {
        age: Number(age),
        goalType,
        conditionFlags,
        injurySeverity,
        redFlags,
      },
      targetMovement,
      symptomsText,
      lifestyleContextText,
      wakeTimeMinutes: wakeTime ? wakeHours * 60 + wakeMinutes : undefined,
      eveningTimeMinutes: eveningTime ? eveningHours * 60 + eveningMinutes : undefined,
      availableEquipment,
    });
  }

  if (crisisDetected) {
    return (
      <main style={pageStyle}>
        <h1>You&apos;re not alone — help is available</h1>
        <p>
          Rebound.ai isn&apos;t equipped to support what you&apos;ve described, and we want to make sure you can
          reach someone who can help right now.
        </p>
        <ul>
          <li>
            <strong>988 Suicide &amp; Crisis Lifeline</strong> — call or text 988 (US), available 24/7.
          </li>
          <li>
            <strong>Crisis Text Line</strong> — text HOME to 741741 (US), available 24/7.
          </li>
          <li>If you&apos;re in immediate danger, call 911 or your local emergency number.</li>
        </ul>
        <p>Please reach out to one of these resources or a trusted person before continuing.</p>
      </main>
    );
  }

  if (cooldownRegimeCreatedAt) {
    const availableAt = new Date(cooldownRegimeCreatedAt);
    availableAt.setDate(availableAt.getDate() + 7);
    return (
      <main style={pageStyle}>
        <h1>You already have an active regime</h1>
        <p>
          To keep things sustainable, a new regime can only be generated once every 7 days while one is active. You
          can wait until {availableAt.toLocaleDateString()}, or restart your current regime now from Settings to
          start fresh immediately.
        </p>
        <p>
          <Link href="/settings/restart-regime" style={{ color: "#2563eb", textDecoration: "underline" }}>
            Restart my regime →
          </Link>
        </p>
      </main>
    );
  }

  if (redFlagReasons) {
    return (
      <main style={pageStyle}>
        <h1>Let&apos;s get you to a professional first</h1>
        <p>
          Based on your answers, Rebound.ai isn&apos;t the right starting point right now. Please see a
          doctor or physical therapist before starting an exercise program.
        </p>
        <ul>
          {redFlagReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </main>
    );
  }

  if (jobId) {
    const status = jobStatus.data?.status;

    return (
      <main style={pageStyle}>
        <h1>Building your regime</h1>
        {status === "COMPLETE" && jobStatus.data?.resultRegimeId ? (
          <>
            <p>Your regime is ready.</p>
            <p>
              <Link href={`/regime/${jobStatus.data.resultRegimeId}`} style={{ color: "#2563eb", textDecoration: "underline" }}>
                Review your regime →
              </Link>
            </p>
          </>
        ) : status === "FAILED" && jobStatus.data?.resultRegimeId ? (
          <>
            <p>
              We couldn&apos;t draft a personalized regime right now, so we&apos;ve started you on a general
              starter plan instead — you can switch to a personalized one later.
            </p>
            <p>
              <Link href={`/regime/${jobStatus.data.resultRegimeId}`} style={{ color: "#2563eb", textDecoration: "underline" }}>
                Review your starter regime →
              </Link>
            </p>
          </>
        ) : status === "FAILED" ? (
          <>
            <p>We couldn&apos;t generate a regime right now. This has been flagged for review.</p>
          </>
        ) : (
          <BuildingPlanStatus />
        )}
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1>Tell us about you</h1>
      <ProgressIndicator step={step} />
      <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>
        {step === 1 && (
          <>
            <label style={fieldStyle}>
              Age
              <input
                type="number"
                required
                min={13}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>

            <label style={fieldStyle}>
              Primary goal
              <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
                {GOAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              Target movement (e.g. &quot;squat without knee pain&quot;)
              <input
                type="text"
                required
                maxLength={200}
                value={targetMovement}
                onChange={(e) => setTargetMovement(e.target.value)}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <label style={fieldStyle}>
              Injury severity
              <select value={injurySeverity} onChange={(e) => setInjurySeverity(e.target.value as InjurySeverity)}>
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend>Do any of these apply to you?</legend>
              {CONDITION_FLAG_OPTIONS.map((option) => (
                <label key={option.value} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={conditionFlags.includes(option.value)}
                    onChange={() => toggleConditionFlag(option.value)}
                  />{" "}
                  {option.label}
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Do you have access to any of these?</legend>
              {EQUIPMENT_OPTIONS.map((option) => (
                <label key={option.value} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={availableEquipment.includes(option.value)}
                    onChange={() => toggleEquipment(option.value)}
                  />{" "}
                  {option.label}
                </label>
              ))}
            </fieldset>

            <label style={fieldStyle}>
              Symptoms — describe what you&apos;re feeling
              <textarea maxLength={750} value={symptomsText} onChange={(e) => setSymptomsText(e.target.value)} rows={4} />
            </label>

            <label style={fieldStyle}>
              Lifestyle context — activity level, job, etc.
              <textarea
                maxLength={750}
                value={lifestyleContextText}
                onChange={(e) => setLifestyleContextText(e.target.value)}
                rows={4}
              />
            </label>

            <label style={fieldStyle}>
              Preferred wake time (morning session)
              <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </label>

            <label style={fieldStyle}>
              Preferred evening session time
              <input type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} />
            </label>
          </>
        )}

        {step === 3 && (
          <fieldset>
            <legend>Please flag anything below that applies right now</legend>
            {RED_FLAG_QUESTIONS.map(({ key, label }) => (
              <label key={key} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={redFlags[key]}
                  onChange={(e) => setRedFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                />{" "}
                {label}
              </label>
            ))}
          </fieldset>
        )}

        {step === 4 && (
          <div style={reviewListStyle}>
            <p>Double-check your answers, then submit.</p>
            <div style={reviewRowStyle}>
              <strong>Age</strong>
              <span>{age || "—"}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Primary goal</strong>
              <span>{GOAL_OPTIONS.find((o) => o.value === goalType)?.label}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Target movement</strong>
              <span>{targetMovement || "—"}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Injury severity</strong>
              <span>{SEVERITY_OPTIONS.find((o) => o.value === injurySeverity)?.label}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Conditions</strong>
              <span>
                {conditionFlags.length
                  ? conditionFlags
                      .map((flag) => CONDITION_FLAG_OPTIONS.find((o) => o.value === flag)?.label ?? flag)
                      .join(", ")
                  : "None"}
              </span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Equipment available</strong>
              <span>
                {availableEquipment.length
                  ? availableEquipment
                      .map((eq) => EQUIPMENT_OPTIONS.find((o) => o.value === eq)?.label ?? eq)
                      .join(", ")
                  : "Bodyweight only"}
              </span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Symptoms</strong>
              <span>{symptomsText || "—"}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Lifestyle context</strong>
              <span>{lifestyleContextText || "—"}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Preferred wake time</strong>
              <span>{wakeTime || "—"}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Preferred evening time</strong>
              <span>{eveningTime || "—"}</span>
            </div>
            <div style={reviewRowStyle}>
              <strong>Red flags</strong>
              <span>
                {RED_FLAG_QUESTIONS.filter(({ key }) => redFlags[key])
                  .map(({ label }) => label)
                  .join(", ") || "None selected"}
              </span>
            </div>
          </div>
        )}

        <div style={navRowStyle}>
          {step > 1 ? (
            <button type="button" onClick={goBack}>
              ← Back
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <button type="button" onClick={goNext}>
              Next →
            </button>
          ) : (
            <button type="submit" disabled={submit.isPending}>
              {submit.isPending ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Submitting…
                </>
              ) : (
                "Continue"
              )}
            </button>
          )}
        </div>

        {submit.isError && (
          <p role="alert" className="banner banner-error">
            {submit.error.message}
          </p>
        )}
      </form>
    </main>
  );
}
