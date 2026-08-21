import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import { registry } from "./index";

const generator = new OpenApiGeneratorV3(registry.definitions);

const document = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Rebound.ai API",
    version: "1.0.0",
    description:
      "Generated from packages/contracts/src/schemas/**. Do not hand-edit — run `pnpm --filter @rebound/contracts generate` after changing a schema.",
  },
  servers: [{ url: "/api/v1" }],
});

const outPath = join(__dirname, "..", "openapi.json");
writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");

console.log(`Wrote ${outPath}`);
