import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem", lineHeight: 1.6 };
const heroTitleStyle: React.CSSProperties = { fontSize: "2.25rem", lineHeight: 1.15, marginBottom: "1rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1.75rem",
  marginTop: "1.5rem",
};
const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#eff6ff",
  color: "#2563eb",
  fontSize: "0.8rem",
  fontWeight: 700,
  padding: "0.25rem 0.65rem",
  borderRadius: 999,
  marginBottom: "0.75rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const primaryCtaStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  color: "#fff",
  padding: "0.85rem 1.75rem",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  marginTop: "1.25rem",
};
const sectionStyle: React.CSSProperties = { padding: "2rem 0", borderTop: "1px solid #eee" };

export const metadata = {
  title: "Pricing — Rebound.ai",
  description: "Rebound.ai is free during the current beta. Subscription pricing hasn't been finalized yet.",
};

export default function PricingPage() {
  return (
    <main style={pageStyle}>
      <h1 style={heroTitleStyle}>Pricing</h1>
      <p>
        Rebound.ai is a subscription product at its core — the plan keeps adapting to you over time, and that
        ongoing adjustment is the whole point. But we&apos;re still in beta, and we&apos;re not charging anyone
        yet.
      </p>

      <div style={cardStyle}>
        <span style={badgeStyle}>CURRENT BETA</span>
        <h2 style={{ marginTop: 0 }}>Free, full access — for now</h2>
        <p>
          Everyone gets full access during the beta: the onboarding questionnaire, your AI-drafted plan, both daily
          sessions, streaks, and every weekly adjustment your plan goes through — no payment required to keep
          using any of it, including past your first regime cycle.
        </p>
        <Link href="/sign-up" style={primaryCtaStyle}>
          Get your plan →
        </Link>
      </div>

      <section style={sectionStyle}>
        <h2>What happens after beta</h2>
        <p>
          Subscription pricing is still being finalized and hasn&apos;t launched yet — we don&apos;t have a final
          number to share, and we&apos;d rather not guess in public before it&apos;s decided. When pricing does
          launch, it&apos;ll happen after the beta period, not in the middle of it.
        </p>
        <p>
          If you&apos;re already using Rebound.ai when that happens, we&apos;ll notify you before anything changes
          for your account — you won&apos;t be switched to a paid plan without a heads-up first.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Questions</h2>
        <p>
          Curious what you&apos;re actually getting for free right now? See{" "}
          <Link href="/how-it-works" style={linkStyle}>
            how Rebound.ai works
          </Link>{" "}
          or{" "}
          <Link href="/safety" style={linkStyle}>
            how it keeps your plan safe
          </Link>
          .
        </p>
        <p>
          <Link href="/" style={linkStyle}>
            ← Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
