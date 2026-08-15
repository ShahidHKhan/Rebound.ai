import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem", lineHeight: 1.6 };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

export const metadata = { title: "Privacy Policy — Rebound.ai" };

export default function PrivacyPage() {
  return (
    <main style={pageStyle}>
      <h1>Privacy Policy</h1>
      <p>Last updated: August 15, 2026.</p>

      <p>
        Rebound.ai (&quot;we,&quot; &quot;us&quot;) is an AI-assisted exercise-regime app. This page explains what
        data we collect, why, who we share it with, and the rights you have over it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account information (your email address, managed by our authentication provider, Clerk).</li>
        <li>
          Onboarding health information you submit: age, goal type, injury/condition details, and free-text
          descriptions of your symptoms and lifestyle context.
        </li>
        <li>
          Ongoing usage data: daily pain scores, session-completion logs, and any regime adjustments generated for
          you.
        </li>
      </ul>

      <h2>How we use AI</h2>
      <p>
        We use Anthropic&apos;s Claude models to draft and adjust your exercise regime and to screen your free-text
        onboarding answers for clinical red flags (including crisis/self-harm language). The free-text health
        information you submit during onboarding is sent to Anthropic for this processing. Anthropic does not use
        this data to train its models under our commercial agreement with them.
      </p>

      <h2>Third parties who process your data</h2>
      <ul>
        <li>
          <strong>Clerk</strong> — authentication and account management.
        </li>
        <li>
          <strong>Supabase</strong> — our database host (Postgres), where your account and health data are stored.
        </li>
        <li>
          <strong>Anthropic</strong> — AI inference for regime generation and clinical-language screening, as
          described above.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the Rebound.ai web application.
        </li>
      </ul>

      <h2>Data retention and deletion</h2>
      <p>
        We retain your data for as long as your account is active. You can permanently delete your account and all
        associated health data at any time from the app&apos;s home screen (&quot;Delete my account&quot;). This
        removes your onboarding answers, regimes, session logs, and account record, and cannot be undone.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Rebound.ai is not a substitute for professional medical or physical-therapy advice, diagnosis, or treatment.
        If you are experiencing a medical emergency, call your local emergency number immediately.
      </p>

      <p>
        <Link href="/terms" style={linkStyle}>
          Terms of Service →
        </Link>
      </p>
    </main>
  );
}
