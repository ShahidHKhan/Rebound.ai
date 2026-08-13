import { describe, expect, it } from "vitest";

import { checkRedFlags } from "../red-flag-screen";
import { baseOnboardingAnswers, baseRedFlags } from "./factories";

describe("checkRedFlags", () => {
  it("does not flag when no red-flag conditions are present", () => {
    const result = checkRedFlags(baseOnboardingAnswers());
    expect(result.flagged).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("flags on a single condition and reports it", () => {
    const answers = baseOnboardingAnswers({ redFlags: baseRedFlags({ severeSuddenPain: true }) });
    const result = checkRedFlags(answers);
    expect(result.flagged).toBe(true);
    expect(result.reasons).toEqual(["severe or sudden-onset pain"]);
  });

  it("collects every triggered condition, not just the first", () => {
    const answers = baseOnboardingAnswers({
      redFlags: baseRedFlags({ numbnessOrTingling: true, cardiacSymptomsWithExertion: true }),
    });
    const result = checkRedFlags(answers);
    expect(result.flagged).toBe(true);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons).toContain("numbness or tingling");
    expect(result.reasons).toContain("cardiac symptoms on exertion");
  });

  it("flags pregnancy-related and post-surgical conditions", () => {
    expect(
      checkRedFlags(baseOnboardingAnswers({ redFlags: baseRedFlags({ pregnancyRelated: true }) })).flagged
    ).toBe(true);
    expect(
      checkRedFlags(baseOnboardingAnswers({ redFlags: baseRedFlags({ recentSurgery: true }) })).flagged
    ).toBe(true);
  });
});
