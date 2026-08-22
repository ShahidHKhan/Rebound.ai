"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiClientError } from "./api-error";

// Clerk's session cookie is short-lived and refreshes on a background cycle
// — a slow interaction can submit right as a refresh is in flight, surfacing
// as a transient 401 that a freshly-refreshed cookie would have cleared.
// React Query's mutation default is retry: 0 (unlike queries, which default
// to 3), so this class of error had zero safety net under tRPC either —
// same reasoning as the old TRPCProvider's shouldRetryMutation, now
// checking ApiClientError instead of TRPCClientError.
function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof ApiClientError && error.status === 401;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
