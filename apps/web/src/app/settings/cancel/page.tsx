"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

const reasonOptions: { value: string; label: string }[] = [
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "NOT_SEEING_RESULTS", label: "Not seeing results" },
  { value: "PLAN_TOO_DEMANDING", label: "Plan is too demanding" },
  { value: "PLAN_TOO_EASY", label: "Plan is too easy" },
  { value: "TECHNICAL_ISSUES", label: "Technical issues" },
  { value: "OTHER", label: "Other" },
];

export default function CancelPage() {
  const [reasonCode, setReasonCode] = useState("");
  const [comment, setComment] = useState("");

  const submitFeedback = trpc.user.submitCancellationFeedback.useMutation();

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/settings/billing" style={linkStyle}>
          ← Back to Billing
        </Link>
      </p>
      <h1>Cancel your plan</h1>

      <p role="alert" className="banner banner-error" style={{ marginBottom: "1rem" }}>
        Billing isn&apos;t live during the beta — this previews what cancellation will look like. Submitting this
        form won&apos;t actually cancel anything; the whole app stays free and fully accessible for every beta user.
      </p>

      {submitFeedback.isSuccess ? (
        <div style={cardStyle}>
          <p className="banner banner-success">
            Thanks for the feedback — we&apos;ve noted it. Nothing about your access has changed; you&apos;re still
            on the full free beta.
          </p>
          <p>
            <Link href="/settings/billing" style={linkStyle}>
              Back to Billing →
            </Link>
          </p>
        </div>
      ) : (
        <form
          style={cardStyle}
          onSubmit={(e) => {
            e.preventDefault();
            if (!reasonCode) return;
            submitFeedback.mutate({
              reasonCode: reasonCode as
                | "TOO_EXPENSIVE"
                | "NOT_SEEING_RESULTS"
                | "PLAN_TOO_DEMANDING"
                | "PLAN_TOO_EASY"
                | "TECHNICAL_ISSUES"
                | "OTHER",
              comment: comment.trim() === "" ? undefined : comment.trim(),
            });
          }}
        >
          <label>
            Why are you thinking about cancelling?
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

          <button type="submit" disabled={!reasonCode || submitFeedback.isPending} style={{ marginTop: "1rem" }}>
            {submitFeedback.isPending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Submitting…
              </>
            ) : (
              "Submit feedback"
            )}
          </button>

          {submitFeedback.isError && (
            <p role="alert" className="banner banner-error" style={{ marginTop: "1rem" }}>
              {submitFeedback.error.message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
