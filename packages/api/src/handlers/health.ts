import type { HealthResponse } from "@rebound/contracts";

// Return type is the response schema's own inferred type — deliberately, so
// a shape mismatch between this handler and packages/contracts/src/schemas/health.ts
// is a compile-time error, not a spec that silently drifts from what the
// server actually sends. Apply this same pattern to every handler.
export async function getHealth(): Promise<HealthResponse> {
  return { ok: true, timestamp: new Date().toISOString() };
}
