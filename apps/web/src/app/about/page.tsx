import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 800, margin: "0 auto", padding: "2rem" };
const heroStyle: React.CSSProperties = { padding: "1rem 0 2rem" };
const heroTitleStyle: React.CSSProperties = { fontSize: "2.25rem", lineHeight: 1.15, marginBottom: "1rem" };
const heroSubStyle: React.CSSProperties = { fontSize: "1.1rem", color: "#444", maxWidth: 640 };
const sectionStyle: React.CSSProperties = { padding: "2.5rem 0", borderTop: "1px solid #eee" };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const ctaRowStyle: React.CSSProperties = { display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" };
const primaryCtaStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  padding: "0.85rem 1.75rem",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
};

export const metadata = {
  title: "About — Rebound.ai",
  description: "Why Rebound.ai exists, who it's for, and what it deliberately doesn't do yet.",
};

export default function AboutPage() {
  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <h1 style={heroTitleStyle}>Train like an athlete, recover like one too.</h1>
        <p style={heroSubStyle}>
          Rebound.ai is an AI-powered recovery and performance app built for athletes — it observes your pain,
          mobility, and strength on a recurring basis and recursively adjusts your training/recovery regime to
          keep you moving toward your goal instead of sidelined by it.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Who it&apos;s for</h2>
        <p>
          Athletes, amateur through competitive, are the primary audience — but the underlying product fully
          supports the general fitness population, people managing chronic or autoimmune conditions, and older
          adults too. Broadening the marketing toward athletes doesn&apos;t narrow who the safety rules protect:
          the same guardrails apply to everyone, regardless of who the homepage is talking to.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Why it exists</h2>
        <p>
          Most people who get injured or fall out of a training rhythm don&apos;t have a fast, direct way back in
          — scheduling a clinician, waiting on insurance authorization, or just not knowing what to do differently
          all get in the way. Rebound.ai skips the gatekeeping: a short questionnaire, an AI-drafted plan, and a
          fixed twice-daily rhythm that adapts to how you&apos;re actually responding, week over week.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>What we deliberately don&apos;t do (yet)</h2>
        <p>
          There&apos;s no licensed physical therapist reviewing your plan at v1 — that&apos;s an honest tradeoff
          we make to keep the product direct-access and low-cost, and it&apos;s exactly why the rules-based safety
          guardrails wrapping every AI decision are non-negotiable rather than a nice-to-have. We also haven&apos;t
          published outcomes data yet — we&apos;d rather earn that with real cohort results than claim it early.
        </p>
        <p>
          <Link href="/safety" style={linkStyle}>
            See the full safety model →
          </Link>
        </p>
      </section>

      <section style={sectionStyle}>
        <div style={ctaRowStyle}>
          <Link href="/sign-up" style={primaryCtaStyle}>
            Get your plan →
          </Link>
        </div>
      </section>
    </main>
  );
}
