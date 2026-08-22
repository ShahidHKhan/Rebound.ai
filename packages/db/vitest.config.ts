import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The RLS suite talks to a real database and opens transactions; the
    // 5s default is tight for a cold connection to a remote Postgres.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
