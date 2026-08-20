"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";

import { trpc } from "./client";

// Clerk's session token is short-lived (60s, refreshed on a ~50s background
// cycle) — a slow interaction (multi-step onboarding, restart-regime's
// reason form) can submit right as a refresh is in flight, surfacing as a
// transient UNAUTHORIZED that a freshly-minted token would have cleared.
// Confirmed live 2026-08-20 on both onboarding.submit and regime.restart.
// React Query's mutation default is retry: 0 (unlike queries, which default
// to 3), so this class of error had zero safety net. Retry once, and only
// for UNAUTHORIZED specifically — a real FORBIDDEN/BAD_REQUEST business
// error is not transient and retrying it would just fail identically.
function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
}

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            retry: shouldRetryMutation,
            retryDelay: 1200,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
