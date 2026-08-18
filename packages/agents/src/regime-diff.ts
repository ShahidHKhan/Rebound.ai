import type { DraftRegime, DraftRegimeExercise } from "@rebound/clinical-rules";

export interface RegimeDiffEntry {
  exerciseId: string;
  change: "added" | "removed" | "changed" | "unchanged";
  before?: DraftRegimeExercise;
  after?: DraftRegimeExercise;
  changedFields?: string[];
}

const COMPARABLE_FIELDS = ["sets", "reps", "durationSeconds", "frequency", "sessionSlot"] as const;

function fieldsChanged(before: DraftRegimeExercise, after: DraftRegimeExercise): string[] {
  return COMPARABLE_FIELDS.filter((field) => before[field] !== after[field]);
}

// Pure comparison, no I/O — compares two regime drafts by exerciseId so a
// scenario cycle's "what changed since the previous/original regime" can be
// shown without re-deriving anything from raw LLM output.
export function diffRegimes(before: DraftRegime, after: DraftRegime): RegimeDiffEntry[] {
  const beforeById = new Map(before.exercises.map((e) => [e.exerciseId, e]));
  const afterById = new Map(after.exercises.map((e) => [e.exerciseId, e]));
  const entries: RegimeDiffEntry[] = [];

  for (const [exerciseId, beforeExercise] of beforeById) {
    const afterExercise = afterById.get(exerciseId);
    if (!afterExercise) {
      entries.push({ exerciseId, change: "removed", before: beforeExercise });
      continue;
    }
    const changedFields = fieldsChanged(beforeExercise, afterExercise);
    entries.push(
      changedFields.length > 0
        ? { exerciseId, change: "changed", before: beforeExercise, after: afterExercise, changedFields }
        : { exerciseId, change: "unchanged", before: beforeExercise, after: afterExercise }
    );
  }

  for (const [exerciseId, afterExercise] of afterById) {
    if (!beforeById.has(exerciseId)) {
      entries.push({ exerciseId, change: "added", after: afterExercise });
    }
  }

  return entries;
}
