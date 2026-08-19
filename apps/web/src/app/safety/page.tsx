import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 800, margin: "0 auto", padding: "2rem" };
const heroStyle: React.CSSProperties = { padding: "1rem 0 2rem" };
const heroTitleStyle: React.CSSProperties = { fontSize: "2.25rem", lineHeight: 1.15, marginBottom: "1rem" };
const heroSubStyle: React.CSSProperties = { fontSize: "1.1rem", color: "#444", maxWidth: 640 };
const sectionStyle: React.CSSProperties = { padding: "2.5rem 0", borderTop: "1px solid #eee" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  marginTop: "1.25rem",
};
const cardLabelStyle: React.CSSProperties = { color: "#2563eb", fontWeight: 700, fontSize: "0.85rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: "1rem" };
const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "2px solid #ddd",
  padding: "0.5rem 0.75rem",
  fontSize: "0.9rem",
};
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "0.6rem 0.75rem", fontSize: "0.9rem" };
const warnStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fca5a5",
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  marginTop: "1.5rem",
};
const ctaRowStyle: React.CSSProperties = { display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" };
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

export const metadata = {
  title: "Safety & Guardrails — Rebound.ai",
  description:
    "How Rebound.ai screens for red flags, limits how fast your plan can change, and watches every log in real time for pain spikes.",
};

export default function SafetyPage() {
  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <h1 style={heroTitleStyle}>Safety &amp; guardrails</h1>
        <p style={heroSubStyle}>
          Rebound.ai runs without a clinician reviewing your plan before it reaches you — that&apos;s what keeps it
          fast and directly accessible. It also means the guardrails on this page aren&apos;t optional polish.
          They&apos;re fixed, rules-based checks that sit between the AI and what actually happens to your plan, and
          they apply to every single user, every time.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Before any plan is generated: red-flag screening</h2>
        <p>Two separate checks run on your onboarding answers before any AI-generated plan is created.</p>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>1. STRUCTURED RED-FLAG SCREEN</div>
          <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            A fixed, rules-based check — no AI judgment involved. Severe or sudden pain, numbness or tingling,
            recent trauma, post-surgical status, pregnancy-related symptoms, or cardiac exertion symptoms all route
            you to &quot;see a doctor or physical therapist&quot; instead of generating a plan.
          </p>
        </div>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>2. FREE-TEXT RED-FLAG CLASSIFIER</div>
          <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            The structured screen only catches what its specific questions ask about. This second pass reads the
            free-text answers you give about your symptoms and lifestyle — where someone might disclose something
            important that a checkbox didn&apos;t ask for — and applies the same &quot;see a doctor&quot; routing
            if it finds a red flag there. Both checks have to pass before a plan is ever drafted.
          </p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Risk tiers set hard limits on how fast your plan can change</h2>
        <p>
          Everyone who clears the red-flag screen is placed into a risk tier based on age, condition details, and
          pain severity. Your tier sets a hard ceiling on how aggressively your plan is allowed to progress —
          independent of what the AI itself might otherwise propose:
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Risk tier</th>
                <th style={thStyle}>Max week-over-week increase</th>
                <th style={thStyle}>Default behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>General / no injury</td>
                <td style={tdStyle}>Up to 10%</td>
                <td style={tdStyle}>Progresses while pain stays low and settled</td>
              </tr>
              <tr>
                <td style={tdStyle}>Light injury</td>
                <td style={tdStyle}>Up to 5%</td>
                <td style={tdStyle}>Smaller steps, requires pain to settle within 24h</td>
              </tr>
              <tr>
                <td style={tdStyle}>Heavier injury / chronic / autoimmune / elderly</td>
                <td style={tdStyle}>Hold by default</td>
                <td style={tdStyle}>Only progresses after two consecutive good cycles</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
          These figures are evidence-informed starting points drawn from sports-rehab load-management conventions —
          not a substitute for individualized clinical judgment. A drafted or proposed plan that would exceed its
          tier&apos;s ceiling is automatically capped or held back before you ever see it; the AI cannot draft its
          way past this limit.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Every log is watched in real time</h2>
        <p>
          Separately from your plan&apos;s scheduled adjustments, a real-time escalation monitor checks{" "}
          <em>every single check-in</em> the moment you submit it — rules-based only, with no dependency on an AI
          call. It&apos;s watching for:
        </p>
        <ul>
          <li>A high pain score on a single log</li>
          <li>A &quot;this made it worse&quot; flag</li>
          <li>A sharp day-over-day jump in pain</li>
          <li>Pain that isn&apos;t settling back down the way it should for your risk tier</li>
        </ul>
        <p>
          Higher-risk tiers trigger a rollback on the first sign of trouble; lower-risk tiers get a short window to
          confirm a pattern before rolling back, rather than reacting to a single noisy data point. When a
          threshold is crossed, your plan is automatically reverted to its last safe version and you&apos;re shown
          clear stop-and-consult messaging — this can happen at any moment, not just on a weekly cycle.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>What happens after a rollback</h2>
        <p>
          After an automatic rollback, Rebound.ai checks in on your trend a few days later using the check-ins
          you&apos;re already logging — no extra work on your part. If pain has stayed at or below the
          rolled-back level, your plan resumes its normal weekly adjustment cycle. If not, the same real-time
          thresholds above continue to apply. Every rollback and every scheduled adjustment is logged, so
          there&apos;s always a record of what changed and why.
        </p>
      </section>

      <section style={sectionStyle}>
        <div style={warnStyle}>
          <h2 style={{ marginTop: 0 }}>This is not a substitute for medical care</h2>
          <p>
            Rebound.ai has no licensed clinician reviewing your plan — the guardrails above are automated,
            rules-based safeguards, not a medical evaluation. They reduce risk; they don&apos;t eliminate it, and
            they can&apos;t replace an in-person assessment.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>See a real doctor or physical therapist</strong> if you have severe or sudden pain, numbness or
            tingling, symptoms after a trauma or surgery, pregnancy-related concerns, chest pain or other cardiac
            symptoms during exertion, or if anything about your condition doesn&apos;t feel right — regardless of
            what Rebound.ai&apos;s guardrails say. If you&apos;re experiencing a medical emergency, call your local
            emergency number immediately.
          </p>
        </div>
      </section>

      <section style={sectionStyle}>
        <p>
          <Link href="/how-it-works" style={linkStyle}>
            ← See how the full plan-building process works
          </Link>
        </p>
        <p>
          <Link href="/privacy" style={linkStyle}>
            Privacy Policy →
          </Link>
        </p>
      </section>

      <section style={{ ...sectionStyle, textAlign: "center" }}>
        <h2>Ready to get started?</h2>
        <div style={{ ...ctaRowStyle, justifyContent: "center" }}>
          <Link href="/sign-up" style={primaryCtaStyle}>
            Get your plan →
          </Link>
          <Link href="/pricing" style={secondaryCtaStyle}>
            See pricing
          </Link>
        </div>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/" style={linkStyle}>
            ← Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
