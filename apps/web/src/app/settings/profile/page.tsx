"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { unwrap } from "@/lib/rest/api-error";
import { api } from "@/lib/rest/client";
import { qk } from "@/lib/rest/query-keys";

const pageStyle: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "2rem" };
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
};
const linkStyle: React.CSSProperties = { color: "#2563eb", textDecoration: "underline" };
const labelStyle: React.CSSProperties = { color: "#666", fontSize: "0.85rem" };

const goalTypeLabels: Record<string, string> = {
  INJURY_RECOVERY: "Injury recovery",
  STRENGTH: "Strength",
  MOBILITY: "Mobility",
  GENERAL_FITNESS: "General fitness",
};

export default function ProfilePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const me = useQuery({
    queryKey: qk.me(),
    queryFn: async () => unwrap(await api.GET("/users/me")),
  });

  return (
    <main style={pageStyle}>
      <p>
        <Link href="/settings" style={linkStyle}>
          ← Back to Settings
        </Link>
      </p>
      <h1>Profile</h1>

      <div style={cardStyle}>
        <p style={labelStyle}>Name</p>
        <p>{!userLoaded ? <span className="spinner" aria-hidden="true" /> : user?.fullName || "Not set"}</p>

        <p style={labelStyle}>Email</p>
        <p>{!userLoaded ? <span className="spinner" aria-hidden="true" /> : user?.primaryEmailAddress?.emailAddress}</p>
      </div>

      <div style={cardStyle}>
        {me.isLoading && (
          <p>
            <span className="spinner" aria-hidden="true" /> Loading…
          </p>
        )}
        {me.isError && (
          <p role="alert" className="banner banner-error">
            Couldn&apos;t load your profile: {me.error.message}
          </p>
        )}
        {me.data && (
          <>
            <p style={labelStyle}>Goal</p>
            <p>{goalTypeLabels[me.data.goalType] ?? me.data.goalType}</p>

            <p style={labelStyle}>Member since</p>
            <p>
              {new Date(me.data.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
