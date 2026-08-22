import { useAuth } from "@clerk/clerk-expo";
import { createContext, useContext, useMemo } from "react";

import { createApiClient } from "./client";

type ApiClient = ReturnType<typeof createApiClient>;

const ApiContext = createContext<ApiClient | null>(null);

// Same reasoning as ../trpc.tsx's TRPCProvider: the client needs a fresh
// getToken() closure bound to this session, constructed once and shared via
// context rather than re-created on every render.
export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error("useApi must be used within ApiProvider");
  }
  return client;
}
