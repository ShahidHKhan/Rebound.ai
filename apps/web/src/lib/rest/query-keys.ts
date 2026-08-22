// Central query-key registry. Call sites on different pages that read the
// same resource (e.g. /settings/profile and /settings/billing both read
// users/me) must use the exact same key array to share one cache entry —
// the dedup every trpc.x.useQuery() call got for free by construction.
export const qk = {
  exercise: (id: string) => ["exercises", id] as const,
  me: () => ["users", "me"] as const,
  notificationTimes: () => ["users", "me", "notification-times"] as const,
  workoutSessionsToday: () => ["workout-sessions", "today"] as const,
  sessionLogs: () => ["session-logs"] as const,
  adjustmentEvents: () => ["adjustment-events"] as const,
  progressSummary: () => ["progress", "summary"] as const,
  streakCalendar: () => ["progress", "streak-calendar"] as const,
  milestones: () => ["progress", "milestones"] as const,
};
