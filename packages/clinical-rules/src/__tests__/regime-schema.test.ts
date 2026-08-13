import { describe, expect, it } from "vitest";

import { validateStructure } from "../regime-schema";

describe("validateStructure", () => {
  it("accepts a well-formed regime using reps", () => {
    const result = validateStructure({
      exercises: [{ exerciseId: "ex_1", sets: 3, reps: 10, sessionSlot: "MORNING" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed regime using durationSeconds", () => {
    const result = validateStructure({
      exercises: [{ exerciseId: "ex_1", sets: 2, durationSeconds: 30, sessionSlot: "EVENING" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty exercise list", () => {
    const result = validateStructure({ exercises: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an exercise with neither reps nor durationSeconds", () => {
    const result = validateStructure({
      exercises: [{ exerciseId: "ex_1", sets: 3, sessionSlot: "MORNING" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sessionSlot value", () => {
    const result = validateStructure({
      exercises: [{ exerciseId: "ex_1", reps: 10, sessionSlot: "AFTERNOON" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects sets outside the sane numeric range", () => {
    const result = validateStructure({
      exercises: [{ exerciseId: "ex_1", sets: 0, reps: 10, sessionSlot: "MORNING" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate exercise entries within the same slot", () => {
    const result = validateStructure({
      exercises: [
        { exerciseId: "ex_1", sets: 3, reps: 10, sessionSlot: "MORNING" },
        { exerciseId: "ex_1", sets: 2, reps: 8, sessionSlot: "MORNING" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("allows the same exercise in both morning and evening slots", () => {
    const result = validateStructure({
      exercises: [
        { exerciseId: "ex_1", sets: 3, reps: 10, sessionSlot: "MORNING" },
        { exerciseId: "ex_1", sets: 3, reps: 10, sessionSlot: "EVENING" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
