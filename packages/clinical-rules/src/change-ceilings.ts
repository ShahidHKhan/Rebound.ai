import type { RiskTier } from "./types";

export interface ChangeCeiling {
  // null here specifically means "hold-only": progress is not permitted
  // through this ceiling check at all (Heavier/chronic/elderly tier).
  maxWeekOverWeekIncreasePct: number | null;
  description: string;
}

// Transcribed from Clinical Risk Framing > Change ceilings (v1 defaults).
// Evidence-informed starting points (10% rule, 0-10 pain traffic light) —
// not clinical prescriptions. Requires PT/clinical advisor sign-off before
// launch (Pre-launch validation).
export const CHANGE_CEILINGS: Record<RiskTier, ChangeCeiling> = {
  GENERAL: {
    maxWeekOverWeekIncreasePct: 10,
    description: "General / no injury — 10% week-over-week ceiling",
  },
  LIGHT_INJURY: {
    maxWeekOverWeekIncreasePct: 5,
    description: "Light injury — 5% week-over-week ceiling (below general population norms by design)",
  },
  HEAVIER_CHRONIC_ELDERLY: {
    maxWeekOverWeekIncreasePct: null,
    description:
      "Heavier injury / chronic / autoimmune / elderly — hold-only by default; progress only after 2 consecutive green cycles (a Flow B decision, not enforced by this ceiling check)",
  },
};

// Conservative absolute bounds on an initial (Flow A) draft, independent of
// any previous regime. Given v1 exercise content carries no PT-annotated
// contraindications, defaults lean conservative — smaller for heavier tiers.
// Same provisional status as the ceilings above.
export interface AbsoluteBounds {
  maxExercises: number;
  maxSetsPerExercise: number;
}

export const ABSOLUTE_BOUNDS: Record<RiskTier, AbsoluteBounds> = {
  GENERAL: { maxExercises: 12, maxSetsPerExercise: 5 },
  LIGHT_INJURY: { maxExercises: 10, maxSetsPerExercise: 4 },
  HEAVIER_CHRONIC_ELDERLY: { maxExercises: 8, maxSetsPerExercise: 3 },
};
