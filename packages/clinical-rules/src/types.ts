import type { RiskTier, SessionSlot } from "@rebound/db";

export type { RiskTier, SessionSlot };

// ── Red-flag screen ─────────────────────────────────────────────────────

export interface RedFlagAnswers {
  severeSuddenPain: boolean;
  numbnessOrTingling: boolean;
  recentTrauma: boolean;
  recentSurgery: boolean;
  pregnancyRelated: boolean;
  cardiacSymptomsWithExertion: boolean;
}

export interface RedFlagResult {
  flagged: boolean;
  reasons: string[];
}

// ── Risk tiering ─────────────────────────────────────────────────────────

export type InjurySeverity = "none" | "mild" | "moderate" | "severe";

export interface OnboardingAnswers {
  age: number;
  goalType: "INJURY_RECOVERY" | "STRENGTH" | "MOBILITY" | "GENERAL_FITNESS";
  // e.g. "autoimmune", "post_surgical", "chronic" — mirrors User.conditionFlags
  conditionFlags: string[];
  injurySeverity: InjurySeverity;
  redFlags: RedFlagAnswers;
}

// ── Regime structure (Flow A/B draft, pre-persistence) ─────────────────────

export interface DraftRegimeExercise {
  exerciseId: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  frequency?: string;
  sessionSlot: SessionSlot;
}

export interface DraftRegime {
  exercises: DraftRegimeExercise[];
}

// ── validateRegime ───────────────────────────────────────────────────────

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ── Escalation monitor ──────────────────────────────────────────────────
// One entry per day of Session Log history, most recent first (index 0 is
// the log that was just written and triggered this check).

export interface SessionLogEntry {
  date: string; // ISO calendar date, e.g. "2026-08-13"
  painScore: number; // 0-10
  madeItWorseFlag: boolean;
}

export type EscalationAction = "none" | "hold" | "flag_for_review" | "rollback";

export interface EscalationResult {
  action: EscalationAction;
  reasons: string[];
}
