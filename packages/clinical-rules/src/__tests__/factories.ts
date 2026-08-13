import type { OnboardingAnswers, RedFlagAnswers } from "../types";

export function baseRedFlags(overrides: Partial<RedFlagAnswers> = {}): RedFlagAnswers {
  return {
    severeSuddenPain: false,
    numbnessOrTingling: false,
    recentTrauma: false,
    recentSurgery: false,
    pregnancyRelated: false,
    cardiacSymptomsWithExertion: false,
    ...overrides,
  };
}

export function baseOnboardingAnswers(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    age: 30,
    goalType: "GENERAL_FITNESS",
    conditionFlags: [],
    injurySeverity: "none",
    redFlags: baseRedFlags(),
    ...overrides,
  };
}
