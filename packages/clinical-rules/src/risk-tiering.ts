import type { OnboardingAnswers, RiskTier } from "./types";

// PRD defines what each tier means (change ceilings, hold/progress/rollback
// conditions) but not the exact onboarding -> tier mapping. These thresholds
// are a provisional starting policy, same status as the change-ceiling
// table itself: not a clinical prescription, pending PT/clinical sign-off
// before launch (Clinical Risk Framing > Pre-launch validation).
const ELDERLY_AGE_THRESHOLD = 65;
const HEAVIER_CONDITION_FLAGS = new Set(["autoimmune", "chronic"]);

export function determineRiskTier(answers: OnboardingAnswers): RiskTier {
  const hasHeavierConditionFlag = answers.conditionFlags.some((flag) =>
    HEAVIER_CONDITION_FLAGS.has(flag)
  );

  if (
    answers.age >= ELDERLY_AGE_THRESHOLD ||
    hasHeavierConditionFlag ||
    answers.injurySeverity === "severe"
  ) {
    return "HEAVIER_CHRONIC_ELDERLY";
  }

  if (answers.injurySeverity === "mild" || answers.injurySeverity === "moderate") {
    return "LIGHT_INJURY";
  }

  return "GENERAL";
}
