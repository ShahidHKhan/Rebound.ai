import { validateRegime, validateStructure } from "@rebound/clinical-rules";

import { generateInitialRegime } from "../src/flow-a";

async function main() {
  const { draft, sourcePresetId } = await generateInitialRegime({
    goalType: "MOBILITY",
    targetMovement: "touching toes without knee bend",
    riskTier: "GENERAL",
    symptomsText: "Mild stiffness in lower back and hamstrings, no sharp pain.",
    lifestyleContextText: "Busy office worker, sits most of the day, ~20 minutes free per session.",
  });

  console.log("Source preset (skeleton used, or null for freeform):", sourcePresetId);
  console.log("Draft regime:", JSON.stringify(draft, null, 2));

  const structural = validateStructure(draft);
  console.log(
    "\nStructural validation:",
    structural.success ? "PASS" : `FAIL - ${JSON.stringify(structural.error?.issues)}`
  );

  if (structural.success) {
    const clinical = validateRegime(draft, "GENERAL");
    console.log("Clinical validation:", clinical.valid ? "PASS" : `FAIL - ${JSON.stringify(clinical.issues)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
