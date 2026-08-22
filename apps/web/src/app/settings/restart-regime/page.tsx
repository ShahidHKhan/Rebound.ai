"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

const reasonOptions: { value: "GOALS_CHANGED" | "STARTING_OVER" | "OTHER"; label: string }[] = [
  { value: "GOALS_CHANGED", label: "My goals changed" },
  { value: "STARTING_OVER", label: "I want to start over" },
  { value: "OTHER", label: "Other" },
];

export default function RestartRegimePage() {
  const [reasonCode, setReasonCode] = useState("");
  const [comment, setComment] = useState("");

  const restart = useMutation({
    mutationFn: async (input: { reasonCode: "GOALS_CHANGED" | "STARTING_OVER" | "OTHER"; comment?: string }) =>
      unwrap(await api.POST("/regimes/restart", { body: input })),
  });

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/settings" style={linkStyle}>
          ← Back to Settings
        </Link>
      </p>
      <h1>Restart your regime</h1>

      <p role="alert" className="banner banner-error" style={{ marginBottom: "1rem" }}>
        This ends your current active regime — it stays in your history but stops being your daily plan.
        You&apos;ll go straight to onboarding to build a new one.
      </p>

      {restart.isSuccess ? (
        <div style={cardStyle}>
          <p className="banner banner-success">Your regime has been ended.</p>
          <p>
            <Link href="/onboarding" style={linkStyle}>
              Build your new regime →
            </Link>
          </p>
        </div>
      ) : (
        <form
          style={cardStyle}
          onSubmit={(e) => {
            e.preventDefault();
            if (!reasonCode) return;
            restart.mutate({
              reasonCode: reasonCode as "GOALS_CHANGED" | "STARTING_OVER" | "OTHER",
              comment: comment.trim() === "" ? undefined : comment.trim(),
            });
          }}
        >
          <label>
            Why are you restarting?
            <select
              required
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              style={{ display: "block", marginTop: "0.25rem", width: "100%" }}
            >
              <option value="" disabled>
                Select a reason
              </option>
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginTop: "1rem" }}>
            Anything else you&apos;d like to add? (optional)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
              style={{ display: "block", marginTop: "0.25rem", width: "100%" }}
            />
          </label>

          <button type="submit" disabled={!reasonCode || restart.isPending} style={{ marginTop: "1rem" }}>
            {restart.isPending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Restarting…
              </>
            ) : (
              "Restart regime"
            )}
          </button>

          {restart.isError && (
            <p role="alert" className="banner banner-error" style={{ marginTop: "1rem" }}>
              {restart.error.message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
