// Mirrors apps/web/src/lib/rest/query-keys.ts — same reasoning, same key
// shapes, kept as a separate copy per this repo's existing "no shared
// client lib between apps" convention.
export const qk = {
  exercise: (id: string) => ["exercises", id] as const,
  me: () => ["users", "me"] as const,
  notificationTimes: () => ["users", "me", "notification-times"] as const,
};
