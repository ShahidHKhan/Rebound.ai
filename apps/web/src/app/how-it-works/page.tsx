import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 800, margin: "0 auto", padding: "2rem" };
const heroStyle: React.CSSProperties = { padding: "1rem 0 2rem" };
const heroTitleStyle: React.CSSProperties = { fontSize: "2.25rem", lineHeight: 1.15, marginBottom: "1rem" };
const heroSubStyle: React.CSSProperties = { fontSize: "1.1rem", color: "#444", maxWidth: 640 };
const sectionStyle: React.CSSProperties = { padding: "2.5rem 0", borderTop: "1px solid #eee" };
const stepCardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1.25rem 1.5rem",
  marginTop: "1.25rem",
};
const stepLabelStyle: React.CSSProperties = { color: "#2563eb", fontWeight: 700, fontSize: "0.85rem" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const noteStyle: React.CSSProperties = {
  background: "#f6f8fb",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem 1.25rem",
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
  title: "How It Works — Rebound.ai",
  description:
    "How Rebound.ai builds and adapts your daily exercise plan: onboarding, AI-drafted regimes, weekly adjustments, and a real-time safety monitor.",
};

export default function HowItWorksPage() {
  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <h1 style={heroTitleStyle}>How Rebound.ai works</h1>
        <p style={heroSubStyle}>
          Rebound.ai isn&apos;t a static workout list — it&apos;s a plan that&apos;s built for you, then keeps
          adapting as you log how you&apos;re actually doing. Here&apos;s the full method, plainly stated: what an
          AI decides, what fixed rules decide, and what runs in real time no matter what.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>1. Onboarding: tell us where you&apos;re at</h2>
        <p>
          You answer a short questionnaire — your goal, target movement, any injury or condition details, and
          free-text context about your symptoms and lifestyle. Before anything else happens, two safety checks run
          on your answers:
        </p>
        <div style={stepCardStyle}>
          <div style={stepLabelStyle}>STRUCTURED RED-FLAG SCREEN</div>
          <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            Rules-based, no AI involved. Severe or sudden pain, numbness/tingling, recent trauma, post-surgical
            status, pregnancy-related symptoms, or cardiac exertion symptoms all route you straight to &quot;see a
            doctor or PT&quot; — no regime is generated.
          </p>
        </div>
        <div style={stepCardStyle}>
          <div style={stepLabelStyle}>FREE-TEXT SAFETY CHECK</div>
          <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            A separate lightweight pass reads your free-text answers for red flags you may have disclosed there
            instead of on the structured questions — the same &quot;see a doctor&quot; routing applies if it finds
            one. This closes a gap a structured form alone can&apos;t catch.
          </p>
        </div>
        <p style={{ marginTop: "1.25rem" }}>
          Everyone who clears both checks is also placed into a risk tier (general, light injury, or
          heavier-injury/chronic/elderly) based on age, condition, and pain severity. That tier sets hard limits on
          how aggressive your plan is ever allowed to get — details on{" "}
          <Link href="/safety" style={linkStyle}>
            the Safety &amp; Guardrails page
          </Link>
          .
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>2. Your first plan is drafted — with rules the AI can&apos;t override</h2>
        <p>
          Once you clear the safety checks, an AI drafts your first two-session daily regime. It doesn&apos;t
          freely generate exercises from scratch — it selects specific exercises from Rebound.ai&apos;s exercise
          library and assigns each one to your morning or evening session, based on the context you gave it. A
          busier schedule gets denser, more efficient sessions; more available time or a training background can
          mean longer or heavier ones.
        </p>
        <p>
          Before you ever see the draft, a separate rules-based validator checks it against your risk tier&apos;s
          limits — flagging anything structurally malformed or outside safe bounds. Only a plan that passes gets
          shown to you, and you can still review and edit it before activating.
        </p>
        <div style={noteStyle}>
          <strong>The key point:</strong> the AI chooses <em>which exercises and when</em>, within bounds it cannot
          set for itself. It never decides how aggressive your plan is allowed to be — that&apos;s a fixed rule,
          checked in code, every time.
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>3. Two sessions a day, every day</h2>
        <p>
          Once your plan is active, you get exactly two sessions a day — one in the morning, one in the evening at
          a time you choose. The morning session also bundles your daily check-in: a quick pain score and whether
          today&apos;s session made things worse. Your streak only needs one of the two sessions completed each
          day, not both — missing a single evening session after doing your morning one won&apos;t break it.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>4. Every log is watched in real time</h2>
        <p>
          Every time you submit a check-in, a rules-based escalation monitor checks it immediately — not once a
          week, right then. It&apos;s looking for pain spikes, a &quot;this made it worse&quot; flag, or pain that
          isn&apos;t settling the way it should for your risk tier. If a threshold is crossed, your plan is
          automatically rolled back to its last safe version and you&apos;re shown clear &quot;stop and consult a
          professional&quot; messaging. This monitor runs on fixed rules only — it never depends on an AI call, so
          it works even if that were ever unavailable.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>5. Your plan adjusts itself, on a schedule</h2>
        <p>
          Separately from the real-time monitor, roughly every week an AI reviews your recent trailing check-ins —
          your pain trend, whether it&apos;s settling, any flags — and proposes holding steady, progressing, or
          pulling back. That proposal goes through the same kind of rules-based validator as your first plan: a
          hard ceiling on how much the plan is allowed to change in one step, tighter for higher-risk tiers, looser
          for lower-risk ones. A proposal that&apos;s too aggressive gets capped or held, never shipped as-is. Every
          adjustment — whether from this weekly process or a real-time rollback — is logged, so there&apos;s a
          record of what changed and why.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Why the rules matter as much as the AI</h2>
        <p>
          Rebound.ai doesn&apos;t have a clinician reviewing your plan before it reaches you — that&apos;s a
          deliberate tradeoff that keeps the product fast and directly accessible, without scheduling, insurance
          authorization, or a diagnosis first. Because there&apos;s no clinician backstop, the guardrails
          described above aren&apos;t optional extras layered on top of the AI — they&apos;re the thing standing
          between an AI&apos;s judgment and what actually reaches you. The AI drafts and proposes; fixed,
          independently-checked rules decide what&apos;s allowed to ship, and a separate real-time monitor watches
          every single log regardless of what either flow decides.
        </p>
        <p>
          <Link href="/safety" style={linkStyle}>
            Read the full Safety &amp; Guardrails breakdown →
          </Link>
        </p>
      </section>

      <section style={{ ...sectionStyle, textAlign: "center" }}>
        <h2>Ready to see your plan?</h2>
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
