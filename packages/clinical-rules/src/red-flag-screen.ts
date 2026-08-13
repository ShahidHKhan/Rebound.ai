import type { OnboardingAnswers, RedFlagAnswers, RedFlagResult } from "./types";

// The exact condition list from Clinical Risk Framing > Concrete onboarding
// safety requirements. Any true answer routes to "see a doctor/PT" with no
// regime generated — this is the only gate that runs before risk tiering.
const RED_FLAG_LABELS: Record<keyof RedFlagAnswers, string> = {
  severeSuddenPain: "severe or sudden-onset pain",
  numbnessOrTingling: "numbness or tingling",
  recentTrauma: "recent trauma",
  recentSurgery: "post-surgical, not yet cleared",
  pregnancyRelated: "pregnancy-related symptoms",
  cardiacSymptomsWithExertion: "cardiac symptoms on exertion",
};

export function checkRedFlags(answers: OnboardingAnswers): RedFlagResult {
  const reasons: string[] = [];

  for (const key of Object.keys(RED_FLAG_LABELS) as (keyof RedFlagAnswers)[]) {
    if (answers.redFlags[key]) {
      reasons.push(RED_FLAG_LABELS[key]);
    }
  }

  return { flagged: reasons.length > 0, reasons };
}
