import { describe, expect, it } from "vitest";

import { checkEscalation } from "../escalation-monitor";
import type { SessionLogEntry } from "../types";

function log(date: string, painScore: number, madeItWorseFlag = false): SessionLogEntry {
  return { date, painScore, madeItWorseFlag };
}

describe("checkEscalation", () => {
  it("does nothing when there is no history yet", () => {
    expect(checkEscalation([], "GENERAL")).toEqual({ action: "none", reasons: [] });
  });

  it("does nothing on stable, low pain with no prior-day jump or flag", () => {
    const logs = [log("d3", 2), log("d2", 2), log("d1", 2)];
    expect(checkEscalation(logs, "GENERAL")).toEqual({ action: "none", reasons: [] });
  });

  it("does nothing on a single day of green-pain history (no yesterday to compare against)", () => {
    expect(checkEscalation([log("d1", 2)], "GENERAL")).toEqual({ action: "none", reasons: [] });
  });

  it("rolls back immediately on a single red (7-10) pain log, for every tier", () => {
    for (const tier of ["GENERAL", "LIGHT_INJURY", "HEAVIER_CHRONIC_ELDERLY"] as const) {
      const result = checkEscalation([log("d1", 8)], tier);
      expect(result.action).toBe("rollback");
      expect(result.reasons).toContain("single log, pain red (7-10)");
    }
  });

  it('rolls back immediately on a "made it worse" flag, independent of pain score', () => {
    const result = checkEscalation([log("d1", 2, true)], "GENERAL");
    expect(result.action).toBe("rollback");
    expect(result.reasons).toContain('"made it worse" flag = true');
  });

  it("combines multiple same-severity rollback reasons rather than dropping either", () => {
    const result = checkEscalation([log("d1", 8, true)], "GENERAL");
    expect(result.action).toBe("rollback");
    expect(result.reasons).toHaveLength(2);
  });

  it("flags for review (not rollback) on a first day-over-day jump >= 2 pts, general tier", () => {
    const logs = [log("d2", 4), log("d1", 2)];
    const result = checkEscalation(logs, "GENERAL");
    expect(result.action).toBe("flag_for_review");
    expect(result.reasons).toContain("day-over-day pain jump >= 2 pts");
  });

  it("escalates to rollback when a day-over-day jump repeats 2 days running, general tier", () => {
    const logs = [log("d3", 6), log("d2", 4), log("d1", 1)];
    const result = checkEscalation(logs, "GENERAL");
    expect(result.action).toBe("rollback");
    expect(result.reasons).toContain("day-over-day pain jump >= 2 pts, repeated 2 days running");
  });

  it("rolls back on the first day-over-day jump for the heavier tier (no second-occurrence grace)", () => {
    const logs = [log("d2", 4), log("d1", 2)];
    const result = checkEscalation(logs, "HEAVIER_CHRONIC_ELDERLY");
    expect(result.action).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/heavier tier: rollback on first occurrence/);
  });

  it("holds on yellow pain not settled to green by next morning, first occurrence, general tier", () => {
    const logs = [log("d2", 5), log("d1", 5)];
    const result = checkEscalation(logs, "GENERAL");
    expect(result.action).toBe("hold");
    expect(result.reasons).toContain("yellow pain not settled to green by next morning");
  });

  it("escalates to rollback when yellow pain fails to settle 2 consecutive times, general tier", () => {
    const logs = [log("d3", 5), log("d2", 5), log("d1", 5)];
    const result = checkEscalation(logs, "GENERAL");
    expect(result.action).toBe("rollback");
    expect(result.reasons).toContain("yellow pain not settled to green, 2 consecutive occurrences");
  });

  it("rolls back on the first non-settling yellow occurrence for the heavier tier", () => {
    const logs = [log("d2", 5), log("d1", 5)];
    const result = checkEscalation(logs, "HEAVIER_CHRONIC_ELDERLY");
    expect(result.action).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/heavier tier: rollback on first occurrence/);
  });
});
