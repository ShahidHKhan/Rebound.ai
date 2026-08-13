function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

// A calendar day maintains the streak if at least one of the day's two
// sessions was completed (Daily Session Structure) — completing both isn't
// required, and a missed single session doesn't break it.
//
// `completedDays` is the set of dates (YYYY-MM-DD) with >=1 completed
// WorkoutSession. `today` anchors the walk; if today has no completion yet
// the streak isn't zeroed out on that basis alone — it's still "alive"
// pending today, as long as yesterday was completed.
export function computeCurrentStreak(completedDays: Set<string>, today: Date): number {
  let cursor = today;
  if (!completedDays.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (completedDays.has(toDateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}
