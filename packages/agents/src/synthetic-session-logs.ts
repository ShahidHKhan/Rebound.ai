import type { SyntheticPainPattern } from "@rebound/db";

export interface SyntheticSessionLog {
  date: string;
  painScore: number;
  madeItWorseFlag: boolean;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function clampPain(score: number): number {
  return Math.max(0, Math.min(10, Math.round(score)));
}

// Most-recent-first (index 0 = today), matching runFlowBForUser's existing
// convention (packages/agents/src/flow-b-runner.ts) for real trailing logs.
export function generateSyntheticSessionLogs(pattern: SyntheticPainPattern, days: number): SyntheticSessionLog[] {
  let painScores: number[];
  let madeItWorseIndex = -1;

  switch (pattern) {
    case "IMPROVING":
      // Today = best (low), oldest day = worst (high).
      painScores = Array.from({ length: days }, (_, i) => clampPain(2 + (5 * i) / Math.max(1, days - 1)));
      break;
    case "WORSENING":
      // Today = worst (high), oldest day = best (low) — matches the
      // hand-written "worsening" fixture this replaces.
      painScores = Array.from({ length: days }, (_, i) => clampPain(8 - (6 * i) / Math.max(1, days - 1)));
      break;
    case "PLATEAUING":
      // Flat around 4-5 with small alternating jitter.
      painScores = Array.from({ length: days }, (_, i) => clampPain(4 + (i % 2 === 0 ? 1 : 0)));
      break;
    case "CONTRADICTORY": {
      // Noisy zigzag between green and red, with a "made it worse" flag on
      // the worst (most recent) day.
      const zigzag = [8, 3, 7, 2, 8, 3, 6, 2, 7, 3, 8, 2, 7, 3];
      painScores = Array.from({ length: days }, (_, i) => clampPain(zigzag[i % zigzag.length]!));
      madeItWorseIndex = 0;
      break;
    }
  }

  return painScores.map((painScore, index) => ({
    date: daysAgo(index),
    painScore,
    madeItWorseFlag: index === madeItWorseIndex,
  }));
}
