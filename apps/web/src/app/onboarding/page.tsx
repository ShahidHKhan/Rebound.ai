"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

type GoalType = "INJURY_RECOVERY" | "STRENGTH" | "MOBILITY" | "GENERAL_FITNESS";
type InjurySeverity = "none" | "mild" | "moderate" | "severe";

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

const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem" };
const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };

export default function OnboardingPage() {
  const [age, setAge] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("GENERAL_FITNESS");
  const [injurySeverity, setInjurySeverity] = useState<InjurySeverity>("none");
  const [conditionFlags, setConditionFlags] = useState<string[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagAnswers>(initialRedFlags);
  const [targetMovement, setTargetMovement] = useState("");
  const [symptomsText, setSymptomsText] = useState("");
  const [lifestyleContextText, setLifestyleContextText] = useState("");

  const [jobId, setJobId] = useState<string | null>(null);
  const [redFlagReasons, setRedFlagReasons] = useState<string[] | null>(null);

  const submit = trpc.onboarding.submit.useMutation({
    onSuccess: (result) => {
      if (result.status === "red_flagged") {
        setRedFlagReasons(result.reasons);
      } else {
        setJobId(result.jobId);
      }
    },
  });

  const jobStatus = trpc.onboarding.getJobStatus.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: jobId !== null,
      refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 2000 : false),
    }
  );

  function toggleConditionFlag(value: string) {
    setConditionFlags((prev) => (prev.includes(value) ? prev.filter((flag) => flag !== value) : [...prev, value]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    });
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
        ) : status === "FAILED" ? (
          <>
            <p>We couldn&apos;t generate a regime right now. This has been flagged for review.</p>
            {jobStatus.data?.error && <p>Details: {jobStatus.data.error}</p>}
          </>
        ) : (
          <p>Drafting your two-session regime — this takes a few seconds…</p>
        )}
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1>Tell us about you</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <label style={fieldStyle}>
          Age
          <input type="number" required min={13} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
        </label>

        <label style={fieldStyle}>
          Primary goal
          <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
            <option value="GENERAL_FITNESS">General fitness</option>
            <option value="INJURY_RECOVERY">Injury recovery</option>
            <option value="STRENGTH">Strength</option>
            <option value="MOBILITY">Mobility</option>
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

        <label style={fieldStyle}>
          Injury severity
          <select value={injurySeverity} onChange={(e) => setInjurySeverity(e.target.value as InjurySeverity)}>
            <option value="none">None</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
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

        <button type="submit" disabled={submit.isPending}>
          {submit.isPending ? "Submitting…" : "Continue"}
        </button>

        {submit.isError && <p role="alert">{submit.error.message}</p>}
      </form>
    </main>
  );
}
