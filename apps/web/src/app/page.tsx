import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 960, margin: "0 auto", padding: "2rem" };
const heroStyle: React.CSSProperties = { textAlign: "center", padding: "3rem 1rem 4rem" };
const heroTitleStyle: React.CSSProperties = { fontSize: "2.5rem", lineHeight: 1.15, marginBottom: "1rem" };
const heroSubStyle: React.CSSProperties = { fontSize: "1.15rem", color: "#444", maxWidth: 640, margin: "0 auto 2rem" };
const ctaRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" };
const primaryCtaStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  padding: "0.85rem 1.75rem",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
};
const secondaryCtaStyle: React.CSSProperties = {
  border: "1px solid #2563eb",
  color: "#2563eb",
  padding: "0.85rem 1.75rem",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
};
const sectionStyle: React.CSSProperties = { padding: "2.5rem 0", borderTop: "1px solid #eee" };
const stepsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1.5rem",
  marginTop: "1.5rem",
};
const stepCardStyle: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 8, padding: "1.25rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

export const metadata = {
  title: "Rebound.ai — Train like an athlete, recover like one too",
  description:
    "An AI-adjusted daily exercise plan that keeps you moving toward your next PR instead of sidelined by pain — no doctor's referral or insurance approval needed.",
};

export default function LandingPage() {
  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <h1 style={heroTitleStyle}>
          Train like an athlete, recover like one too.
        </h1>
        <p style={heroSubStyle}>
          Rebound.ai builds an AI-adjusted daily exercise plan that keeps you moving toward your next PR instead of
          sidelined by pain — no doctor&apos;s referral or insurance approval needed.
        </p>
        <div style={ctaRowStyle}>
          <SignedOut>
            <Link href="/sign-up" style={primaryCtaStyle}>
              Get your plan →
            </Link>
            <Link href="/how-it-works" style={secondaryCtaStyle}>
              See how it works
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/today" style={primaryCtaStyle}>
              Go to today&apos;s sessions →
            </Link>
          </SignedIn>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>How it works</h2>
        <div style={stepsGridStyle}>
          <div style={stepCardStyle}>
            <h3>1. Tell us where you&apos;re at</h3>
            <p>A short questionnaire on your goal, training load, and any injury or condition details.</p>
          </div>
          <div style={stepCardStyle}>
            <h3>2. Get a plan built for you</h3>
            <p>
              AI drafts a two-session daily regime — one on wake, one at a time you pick — wrapped in rules-based
              safety guardrails, not just AI judgment alone.
            </p>
          </div>
          <div style={stepCardStyle}>
            <h3>3. It adapts as you go</h3>
            <p>
              Log how each day feels and the plan recursively adjusts week to week, with a real-time monitor
              watching for pain spikes the whole time.
            </p>
          </div>
        </div>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/how-it-works" style={linkStyle}>
            Read the full method →
          </Link>
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Built with guardrails, not just AI judgment</h2>
        <p>
          Every plan is screened for red flags before it&apos;s generated, held to change limits grounded in load-
          management research, and watched by a real-time escalation monitor that can roll a plan back the moment
          your logs say it should. Athletes get injured too — the same guardrails that stop a regime from
          progressing too fast for one person are exactly what stop another from re-aggravating an injury by
          pushing back too soon.
        </p>
        <p style={{ marginTop: "1rem" }}>
          <Link href="/safety" style={linkStyle}>
            See the full safety model →
          </Link>
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Direct access, no gatekeeping</h2>
        <p>
          No employer coverage, insurance authorization, or diagnosis required to start. No scheduling, no hardware
          — just a questionnaire and a plan, built as a training tool as much as a rehab one: in-season load
          management and mobility work included, not only diagnosed injuries.
        </p>
      </section>

      <section style={{ ...sectionStyle, textAlign: "center" }}>
        <h2>Ready to start?</h2>
        <div style={{ ...ctaRowStyle, marginTop: "1rem" }}>
          <SignedOut>
            <Link href="/sign-up" style={primaryCtaStyle}>
              Get your plan →
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/today" style={primaryCtaStyle}>
              Go to today&apos;s sessions →
            </Link>
          </SignedIn>
          <Link href="/pricing" style={secondaryCtaStyle}>
            See pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
