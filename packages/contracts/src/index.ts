export { registry } from "./registry";

// Every schema module registers itself (schemas + paths) as a side effect of
// being imported — re-export the schema/type surface here, and import every
// module here too, so both `generate.ts` (which needs every path registered)
// and consumers (which need the types) go through this one file.
export * from "./schemas/health";
