export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// YYYY-MM-DD, UTC-based — matches how streak.ts keys completed days, so date
// arithmetic here stays consistent with computeCurrentStreak's own walk.
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

// Whole days between two dates, compared by their UTC date-only key (not raw
// millisecond diff) so a User.createdAt timestamp with a real time-of-day
// component doesn't skew the count by comparing against a midnight-anchored
// WorkoutSession.date.
export function daysBetween(from: Date, to: Date): number {
  const fromMs = new Date(toDateKey(from)).getTime();
  const toMs = new Date(toDateKey(to)).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}
