"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useRef } from "react";

import { trpc } from "@/lib/trpc/client";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const dangerStyle: React.CSSProperties = { color: "#b91c1c" };

function DeleteAccountSection() {
  const { signOut } = useClerk();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const deleteAccount = trpc.user.deleteMyAccount.useMutation({
    onSuccess: () => signOut({ redirectUrl: "/" }),
  });

  return (
    <div style={cardStyle}>
      <h2>Danger zone</h2>
      <button type="button" onClick={() => dialogRef.current?.showModal()} style={dangerStyle}>
        Delete my account
      </button>
      <dialog ref={dialogRef} className="confirm-modal">
        <p role="alert" style={{ marginBottom: "1rem" }}>
          This permanently deletes your account, regimes, and session history. This can&apos;t be undone.
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" disabled={deleteAccount.isPending} onClick={() => deleteAccount.mutate()} style={dangerStyle}>
            {deleteAccount.isPending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Deleting…
              </>
            ) : (
              "Yes, permanently delete my account"
            )}
          </button>
          <button type="button" onClick={() => dialogRef.current?.close()} disabled={deleteAccount.isPending}>
            Cancel
          </button>
        </div>
        {deleteAccount.isError && (
          <p role="alert" className="banner banner-error" style={{ marginTop: "1rem" }}>
            {deleteAccount.error.message}
          </p>
        )}
      </dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main style={pageStyle}>
      <h1>Settings</h1>

      <div style={cardStyle}>
        <h2>Account</h2>
        <p>
          <Link href="/settings/profile" style={linkStyle}>
            Profile
          </Link>
        </p>
        <p>
          <Link href="/settings/billing" style={linkStyle}>
            Subscription &amp; Billing
          </Link>
        </p>
        <p>
          <Link href="/settings/cancel" style={linkStyle}>
            Cancel plan
          </Link>
        </p>
        <p>
          <Link href="/settings/restart-regime" style={linkStyle}>
            Restart regime
          </Link>
        </p>
      </div>

      <div style={cardStyle}>
        <h2>Notifications</h2>
        <p>
          <Link href="/settings/notifications" style={linkStyle}>
            Morning &amp; evening session times
          </Link>
        </p>
      </div>

      <div style={cardStyle}>
        <h2>Support</h2>
        <p>
          <Link href="/help" style={linkStyle}>
            Help &amp; FAQ
          </Link>
        </p>
      </div>

      <div style={cardStyle}>
        <h2>Legal</h2>
        <p>
          <Link href="/privacy" style={linkStyle}>
            Privacy Policy
          </Link>
        </p>
        <p>
          <Link href="/terms" style={linkStyle}>
            Terms of Service
          </Link>
        </p>
      </div>

      <DeleteAccountSection />
    </main>
  );
}
