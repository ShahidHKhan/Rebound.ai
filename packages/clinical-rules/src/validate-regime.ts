import { ABSOLUTE_BOUNDS, CHANGE_CEILINGS } from "./change-ceilings";
import type { DraftRegime, DraftRegimeExercise, RiskTier, ValidationIssue, ValidationResult } from "./types";

// A simple, deterministic volume proxy: sets x (reps or duration-in-seconds).
// Not clinically precise, but consistent and comparable week-over-week,
// which is all the delta check needs.
function exerciseVolume(exercise: DraftRegimeExercise): number {
  const sets = exercise.sets ?? 1;
  const repsOrDuration = exercise.reps ?? exercise.durationSeconds ?? 1;
  return sets * repsOrDuration;
}

function totalVolume(regime: DraftRegime): number {
  return regime.exercises.reduce((sum, exercise) => sum + exerciseVolume(exercise), 0);
}

// One shared function: absolute bounds always run; the week-over-week delta
// check only runs when previousRegime is supplied (true for Flow B,
// naturally absent for Flow A). See Clinical Risk Framing > Regime
// Generation Architecture > Validator scope.
export function validateRegime(
  draft: DraftRegime,
  riskTier: RiskTier,
  previousRegime?: DraftRegime
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const bounds = ABSOLUTE_BOUNDS[riskTier];

  if (draft.exercises.length > bounds.maxExercises) {
    issues.push({
      code: "TOO_MANY_EXERCISES",
      message: `regime has ${draft.exercises.length} exercises, exceeding the ${riskTier} tier's max of ${bounds.maxExercises}`,
    });
  }

  for (const exercise of draft.exercises) {
    const sets = exercise.sets ?? 1;
    if (sets > bounds.maxSetsPerExercise) {
      issues.push({
        code: "TOO_MANY_SETS",
        message: `exercise ${exercise.exerciseId} has ${sets} sets, exceeding the ${riskTier} tier's max of ${bounds.maxSetsPerExercise}`,
      });
    }
  }

  if (previousRegime) {
    const previousVolume = totalVolume(previousRegime);
    const newVolume = totalVolume(draft);
    const pctChange = previousVolume === 0 ? 0 : ((newVolume - previousVolume) / previousVolume) * 100;
    const ceiling = CHANGE_CEILINGS[riskTier];

    if (ceiling.maxWeekOverWeekIncreasePct === null) {
      if (pctChange > 0) {
        issues.push({
          code: "PROGRESSION_NOT_ALLOWED",
          message: `${riskTier} tier is hold-only by default; proposed regime increases volume by ${pctChange.toFixed(1)}%`,
        });
      }
    } else if (pctChange > ceiling.maxWeekOverWeekIncreasePct) {
      issues.push({
        code: "EXCEEDS_CHANGE_CEILING",
        message: `proposed week-over-week volume increase of ${pctChange.toFixed(1)}% exceeds this user's ${ceiling.maxWeekOverWeekIncreasePct}% ceiling — revise`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
