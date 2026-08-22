import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiClientError } from "./api-error";

// Mirrors apps/web/src/lib/rest/QueryProvider.tsx — same reasoning as the
// old TRPCProvider's shouldRetryMutation, now checking ApiClientError
// instead of TRPCClientError.
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
