import { describe, expect, it } from "vitest";

import { determineRiskTier } from "../risk-tiering";
import { baseOnboardingAnswers } from "./factories";

describe("determineRiskTier", () => {
  it("defaults healthy, non-elderly users to GENERAL", () => {
    expect(determineRiskTier(baseOnboardingAnswers())).toBe("GENERAL");
  });

  it("routes elderly users to HEAVIER_CHRONIC_ELDERLY regardless of other answers", () => {
    expect(determineRiskTier(baseOnboardingAnswers({ age: 65 }))).toBe("HEAVIER_CHRONIC_ELDERLY");
    expect(determineRiskTier(baseOnboardingAnswers({ age: 80 }))).toBe("HEAVIER_CHRONIC_ELDERLY");
  });

  it("keeps a 64-year-old with a mild injury at LIGHT_INJURY (below the elderly threshold)", () => {
    expect(determineRiskTier(baseOnboardingAnswers({ age: 64, injurySeverity: "mild" }))).toBe(
      "LIGHT_INJURY"
    );
  });

  it("routes autoimmune and chronic condition flags to HEAVIER_CHRONIC_ELDERLY", () => {
    expect(determineRiskTier(baseOnboardingAnswers({ conditionFlags: ["autoimmune"] }))).toBe(
      "HEAVIER_CHRONIC_ELDERLY"
    );
    expect(determineRiskTier(baseOnboardingAnswers({ conditionFlags: ["chronic"] }))).toBe(
      "HEAVIER_CHRONIC_ELDERLY"
    );
  });

  it("does not treat every condition flag as heavier-tier", () => {
    expect(determineRiskTier(baseOnboardingAnswers({ conditionFlags: ["post_surgical"] }))).toBe("GENERAL");
  });

  it("routes severe self-reported injury severity to HEAVIER_CHRONIC_ELDERLY", () => {
    expect(determineRiskTier(baseOnboardingAnswers({ injurySeverity: "severe" }))).toBe(
      "HEAVIER_CHRONIC_ELDERLY"
    );
  });

  it("routes mild/moderate injury severity to LIGHT_INJURY", () => {
    expect(determineRiskTier(baseOnboardingAnswers({ injurySeverity: "mild" }))).toBe("LIGHT_INJURY");
    expect(determineRiskTier(baseOnboardingAnswers({ injurySeverity: "moderate" }))).toBe("LIGHT_INJURY");
  });
});
