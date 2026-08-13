import { describe, expect, it } from "vitest";

import type { DraftRegime, DraftRegimeExercise } from "../types";
import { validateRegime } from "../validate-regime";

function exercise(overrides: Partial<DraftRegimeExercise> = {}): DraftRegimeExercise {
  return { exerciseId: "ex_1", sets: 2, reps: 10, sessionSlot: "MORNING", ...overrides };
}

function regimeWith(count: number, sets = 2): DraftRegime {
  return {
    exercises: Array.from({ length: count }, (_, i) => exercise({ exerciseId: `ex_${i}`, sets })),
  };
}

describe("validateRegime — absolute bounds (Flow A, no previousRegime)", () => {
  it("accepts a regime within the GENERAL tier's bounds", () => {
    const result = validateRegime(regimeWith(10), "GENERAL");
    expect(result.valid).toBe(true);
  });

  it("rejects a regime exceeding the GENERAL tier's max exercise count", () => {
    const result = validateRegime(regimeWith(13), "GENERAL");
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("TOO_MANY_EXERCISES");
  });

  it("rejects a regime exceeding the tier's max sets per exercise", () => {
    const result = validateRegime({ exercises: [exercise({ sets: 6 })] }, "GENERAL");
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("TOO_MANY_SETS");
  });

  it("applies stricter bounds for the heavier tier than for general", () => {
    // 9 exercises is within GENERAL's bound (12) but exceeds HEAVIER's (8).
    expect(validateRegime(regimeWith(9), "GENERAL").valid).toBe(true);
    expect(validateRegime(regimeWith(9), "HEAVIER_CHRONIC_ELDERLY").valid).toBe(false);
  });
});

describe("validateRegime — week-over-week delta check (Flow B, previousRegime supplied)", () => {
  it("allows an increase at or under the GENERAL tier's 10% ceiling", () => {
    // previous volume = 5 exercises x 2 sets x 10 reps = 100; new = 110 (10% up)
    const previous = regimeWith(5);
    const proposed: DraftRegime = { exercises: [...regimeWith(5).exercises, exercise({ exerciseId: "extra", sets: 1, reps: 10 })] };
    const result = validateRegime(proposed, "GENERAL", previous);
    expect(result.valid).toBe(true);
  });

  it("rejects an increase past the GENERAL tier's 10% ceiling with the PRD's rejection-message shape", () => {
    // previous volume = 100 (5 x 2 x 10); new = 122 (22% up)
    const previous = regimeWith(5);
    const proposed: DraftRegime = {
      exercises: [...regimeWith(5).exercises, exercise({ exerciseId: "extra", sets: 2, reps: 11 })],
    };
    const result = validateRegime(proposed, "GENERAL", previous);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === "EXCEEDS_CHANGE_CEILING");
    expect(issue?.message).toMatch(/exceeds this user's 10% ceiling/);
  });

  it("applies the LIGHT_INJURY tier's tighter 5% ceiling", () => {
    // previous volume = 100; new = 106 (6% up) — under GENERAL's ceiling, over LIGHT_INJURY's
    const previous = regimeWith(5);
    const proposed: DraftRegime = {
      exercises: [...regimeWith(5).exercises.slice(0, 4), exercise({ exerciseId: "ex_4", sets: 2, reps: 13 })],
    };
    expect(validateRegime(proposed, "GENERAL", previous).valid).toBe(true);
    expect(validateRegime(proposed, "LIGHT_INJURY", previous).valid).toBe(false);
  });

  it("rejects any volume increase at all for the hold-only heavier tier", () => {
    const previous = regimeWith(5);
    const proposed: DraftRegime = {
      exercises: [...regimeWith(5).exercises.slice(0, 4), exercise({ exerciseId: "ex_4", sets: 2, reps: 11 })],
    };
    const result = validateRegime(proposed, "HEAVIER_CHRONIC_ELDERLY", previous);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("PROGRESSION_NOT_ALLOWED");
  });

  it("allows a hold (no volume change) for the heavier tier", () => {
    const previous = regimeWith(5);
    const result = validateRegime(regimeWith(5), "HEAVIER_CHRONIC_ELDERLY", previous);
    expect(result.valid).toBe(true);
  });

  it("always allows a decrease (rollback), regardless of tier", () => {
    const previous = regimeWith(5);
    const rolledBack = regimeWith(3);
    expect(validateRegime(rolledBack, "GENERAL", previous).valid).toBe(true);
    expect(validateRegime(rolledBack, "HEAVIER_CHRONIC_ELDERLY", previous).valid).toBe(true);
  });
});
