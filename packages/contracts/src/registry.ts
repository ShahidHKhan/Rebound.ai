import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Must run before any schema file calls .openapi() on a Zod schema — every
// schema file in ./schemas imports { registry } from here first, which
// transitively runs this.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Bearer auth (mobile) / same-origin session cookie (web) — mirrors
// packages/api/src/trpc.ts's protectedProcedure. Registered once here so any
// schema file can reference it on a path via `security: [{ bearerAuth: [] }]`.
// Cookie auth has no standard OpenAPI representation that generated clients
// need to act on (the browser attaches it automatically), so only the
// Bearer scheme is registered — it's documentation for the mobile/curl case,
// not something the web generated client needs to read.
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
});
