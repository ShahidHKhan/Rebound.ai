import Link from "next/link";

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem", lineHeight: 1.6 };
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };

export const metadata = { title: "Help & FAQ — Rebound.ai" };

export default function HelpPage() {
  return (
    <main style={pageStyle}>
      <h1>Help &amp; FAQ</h1>

      <h2>How does the AI plan work?</h2>
      <p>
        When you finish onboarding, an AI model drafts a personalized exercise regime from your stated goal and
        health questionnaire answers. As you log sessions and daily pain check-ins, the same system periodically
        reviews your recent trend and can adjust your plan — holding it steady, progressing it, or rolling it back —
        based on how you&apos;re actually responding, not a fixed schedule.
      </p>

      <h2>Is this safe? What if something hurts?</h2>
      <p>
        Rebound.ai screens for clinical red flags during onboarding and monitors your daily check-ins for signs a
        session made things worse. If you ever feel sharp, severe, or worsening pain, stop the exercise and consult
        a medical professional — the app is not a substitute for that. See{" "}
        <Link href="/safety" style={linkStyle}>
          Safety &amp; Guardrails
        </Link>{" "}
        for more on how the red-flag screening and escalation monitoring work.
      </p>

      <h2>How do I change my reminder times?</h2>
      <p>
        Your morning and evening session times are set during onboarding and used to schedule your twice-daily
        reminders. To change them, go to Settings → Profile from the app&apos;s home screen. If reminder-time editing
        isn&apos;t available there yet in your version of the app, it&apos;s on the roadmap — for now, redoing
        onboarding also lets you resubmit your preferred times.
      </p>

      <h2>How do I cancel?</h2>
      <p>
        Rebound.ai is completely free during the beta — there is no subscription to cancel yet. You can preview what
        the future cancellation flow will look like from Settings →{" "}
        <Link href="/settings/cancel" style={linkStyle}>
          Cancel plan
        </Link>
        , but nothing about your access changes when you use it. If you&apos;d like to stop using the app entirely
        and remove your data, use &quot;Delete my account&quot; in Settings instead.
      </p>

      <h2>What happens to my data?</h2>
      <p>
        See our{" "}
        <Link href="/privacy" style={linkStyle}>
          Privacy Policy
        </Link>{" "}
        for the full details on what we collect, how AI processing works, and how to permanently delete your
        account and data.
      </p>

      <p>
        <Link href="/settings" style={linkStyle}>
          ← Back to Settings
        </Link>
      </p>
    </main>
  );
}
