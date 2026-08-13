"use client";

import { trpc } from "@/lib/trpc/client";

export default function Home() {
  const health = trpc.health.ping.useQuery();

  return (
    <main style={{ padding: "2rem", fontFamily: "var(--font-geist-sans)" }}>
      <h1>Rebound.ai</h1>
      <p>
        tRPC health check:{" "}
        {health.isLoading
          ? "checking..."
          : health.error
            ? `error: ${health.error.message}`
            : `ok (${health.data?.timestamp})`}
      </p>
    </main>
  );
}
