import { useAuth } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@rebound/api";

export const trpc = createTRPCReact<AppRouter>();

// Same reasoning as apps/web's Provider.tsx: Clerk's session token is
// short-lived, and React Query's mutation default (retry: 0) has no safety
// net for a transient UNAUTHORIZED. getToken() is fetched fresh per-request
// here (not a passive cookie like web), so this is less exposed, but not
// immune — kept for consistency and defense in depth.
function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
}

// Same-origin trick from the web client doesn't apply on-device — the
// backend host must be reachable over the network, not localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL is not set");
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
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
          url: `${API_URL}/api/trpc`,
          transformer: superjson,
          async headers() {
            const token = await getToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
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
