"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/client";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

export default function BillingPage() {
  const me = trpc.user.getMe.useQuery();

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/settings" style={linkStyle}>
          ← Back to Settings
        </Link>
      </p>
      <h1>Subscription &amp; Billing</h1>

      <div style={cardStyle}>
        {me.isLoading && (
          <p>
            <span className="spinner" aria-hidden="true" /> Loading…
          </p>
        )}
        {me.isError && (
          <p role="alert" className="banner banner-error">
            Couldn&apos;t load your billing status: {me.error.message}
          </p>
        )}
        {me.data && (
          <>
            <h2>Status</h2>
            {me.data.billing.trialActive ? (
              <p className="banner banner-success">
                You&apos;re in your free trial — full access through your first plan adjustment.
              </p>
            ) : (
              <p className="banner banner-success">
                Your plan had its first automatic adjustment on{" "}
                {new Date(me.data.billing.firstAdjustmentAt!).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                — subscription billing isn&apos;t live yet, so you keep full access during the beta at no charge.
              </p>
            )}
          </>
        )}
      </div>

      {/* Paywall/upgrade preview — page-map spec: "surfaced at the natural
          trigger point (first Flow B adjustment) rather than an upfront
          gate." Only shown once that trigger has actually happened, never
          as a blocking interstitial elsewhere in the app. */}
      {me.data && !me.data.billing.trialActive && (
        <div style={cardStyle}>
          <h2>Rebound.ai is launching paid plans soon</h2>
          <p>
            You&apos;ll keep full access through the beta at no charge — we&apos;ll notify you before anything
            changes, well ahead of any billing start date.
          </p>
          <button type="button" disabled title="Not available yet — beta users keep full access at no charge">
            Notify me when pricing is announced
          </button>
        </div>
      )}

      <div style={cardStyle}>
        <p>
          <Link href="/settings/cancel" style={linkStyle}>
            Cancel my plan →
          </Link>
        </p>
      </div>
    </main>
  );
}
