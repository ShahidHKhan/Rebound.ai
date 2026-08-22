import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { components } from "./rest/schema";

export type TodayData = components["schemas"]["WorkoutSessionToday"];
type Session = TodayData["sessions"][number];

const CHANNEL_ID = "daily-sessions";

const NOTIFICATION_IDS = {
  MORNING: "daily-session-morning",
  EVENING: "daily-session-evening",
} as const;

const COPY = {
  MORNING: {
    title: "Good morning — check in and get moving",
    body: "Log how you're feeling, then knock out your first session of the day.",
  },
  EVENING: {
    title: "Evening session time",
    body: "Wrap up the day with your second session — keep the streak alive.",
  },
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily session reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// If today's occurrence for a slot already happened (time passed, or the
// user already completed it), approximate tomorrow's by shifting the
// time-of-day +1 day. There's no future WorkoutSession row to read a real
// value from yet (they're only ever created for "today", at regime.activate)
// — this self-corrects to a fresh server-computed time next time the app is
// opened and re-syncs, so a couple minutes of drift on the sunset-anchored
// evening slot is an accepted tradeoff, not a bug.
function nextOccurrence(scheduledAt: Date, completedAt: Date | null, now: Date): Date {
  const isPastOrDone = completedAt != null || scheduledAt.getTime() <= now.getTime();
  if (!isPastOrDone) return scheduledAt;
  const next = new Date(scheduledAt);
  next.setDate(next.getDate() + 1);
  return next;
}

export async function syncDailyNotifications(sessions: Session[]): Promise<void> {
  try {
    await ensureAndroidChannel();

    await Promise.all(
      Object.values(NOTIFICATION_IDS).map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      )
    );

    const granted = await ensurePermission();
    if (!granted) return;

    const now = new Date();

    for (const slot of ["MORNING", "EVENING"] as const) {
      const session = sessions.find((s) => s.slot === slot);
      if (!session) continue;

      // scheduledAt/completedAt cross the wire as ISO strings now (REST, no
      // superjson) — parsed here, at the one point they're consumed, rather
      // than threading Date objects through the whole component tree.
      const scheduledAt = new Date(session.scheduledAt);
      const completedAt = session.completedAt ? new Date(session.completedAt) : null;
      const when = nextOccurrence(scheduledAt, completedAt, now);
      const { title, body } = COPY[slot];

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS[slot],
        content: { title, body, sound: "default" },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    console.warn("[notifications] failed to sync daily notifications", err);
  }
}
