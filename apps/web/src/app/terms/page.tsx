import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem", lineHeight: 1.6 };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

export const metadata = { title: "Terms of Service — Rebound.ai" };

export default function TermsPage() {
  return (
    <main style={pageStyle}>
      <h1>Terms of Service</h1>
      <p>Last updated: August 15, 2026.</p>

      <p>By using Rebound.ai, you agree to these terms.</p>

      <h2>Not medical advice</h2>
      <p>
        Rebound.ai generates exercise regimes using AI and rules-based safety checks, but it is not a medical device
        and does not provide medical advice, diagnosis, or treatment. It is not a substitute for care from a
        licensed physician or physical therapist. Always consult a qualified professional before starting any
        exercise program, especially if you have a pre-existing injury or condition.
      </p>

      <h2>If you&apos;re in crisis</h2>
      <p>
        If you or someone else is in immediate danger, call your local emergency number (911 in the US). If
        you&apos;re experiencing a mental health crisis, you can reach the 988 Suicide &amp; Crisis Lifeline (call or
        text 988 in the US) or the Crisis Text Line (text HOME to 741741). Rebound.ai is not equipped to provide
        crisis intervention.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate information during onboarding and daily check-ins — the safety guardrails rely on it.</li>
        <li>Stop and seek professional care if a session log or the app tells you to.</li>
        <li>Use the app for its intended purpose; don&apos;t attempt to circumvent its safety screens.</li>
      </ul>

      <h2>Account termination</h2>
      <p>
        You may delete your account at any time from the app&apos;s home screen. We may suspend or terminate access
        for misuse of the service.
      </p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms as the product evolves. Material changes will be reflected here with an updated date.</p>

      <p>
        <Link href="/privacy" style={linkStyle}>
          Privacy Policy →
        </Link>
      </p>
    </main>
  );
}
