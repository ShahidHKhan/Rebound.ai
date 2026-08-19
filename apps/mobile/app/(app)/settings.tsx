import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/ChipGroup";
import { useAccessibility } from "../../lib/accessibility";
import { trpc } from "../../lib/trpc";
import { useSharedStyles } from "../../lib/styles";

function formatTimeOfDay(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

// Same scrollable-chip time picker pattern as onboarding.tsx — 48 half-hour
// options, no native time picker dependency.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30).map((minutes) => ({
  value: String(minutes),
  label: formatTimeOfDay(minutes),
}));

// Notification settings: lets the user revisit the morning wake time /
// evening session time they set once at onboarding (User.wakeTimeMinutes /
// eveningTimeMinutes) — previously no way to change these after the fact.
// Added directly into the existing Settings screen rather than a new route,
// since it stays small (page-map.md's Engagement & Motivation section).
function NotificationTimesSection() {
  const shared = useSharedStyles();
  const utils = trpc.useUtils();
  const current = trpc.user.getNotificationTimes.useQuery();

  const [wakeTimeMinutes, setWakeTimeMinutes] = useState<string[]>(["420"]);
  const [eveningTimeMinutes, setEveningTimeMinutes] = useState<string[]>(["1080"]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!current.data) return;
    if (current.data.wakeTimeMinutes != null) setWakeTimeMinutes([String(current.data.wakeTimeMinutes)]);
    if (current.data.eveningTimeMinutes != null) setEveningTimeMinutes([String(current.data.eveningTimeMinutes)]);
  }, [current.data]);

  const update = trpc.user.updateNotificationTimes.useMutation({
    onSuccess: () => {
      setSaved(true);
      // HomeScreen's effect re-syncs local notifications whenever
      // workoutSession.today's data changes — invalidating it here is the
      // cleanest way to pick up the new times without calling
      // syncDailyNotifications directly from this screen.
      utils.workoutSession.today.invalidate();
    },
  });

  function toggleSingle(setter: (v: string[]) => void, value: string) {
    setSaved(false);
    setter([value]);
  }

  return (
    <View style={shared.card}>
      <Text style={shared.subtitle}>Notification times</Text>
      <Text>Your morning wake time and evening session time.</Text>

      <Text style={shared.label}>Morning wake time</Text>
      <ChipGroup
        options={TIME_OPTIONS}
        selected={wakeTimeMinutes}
        onToggle={(v) => toggleSingle(setWakeTimeMinutes, v)}
        scrollable
      />

      <Text style={shared.label}>Evening session time</Text>
      <ChipGroup
        options={TIME_OPTIONS}
        selected={eveningTimeMinutes}
        onToggle={(v) => toggleSingle(setEveningTimeMinutes, v)}
        scrollable
      />

      <Button
        label="Save"
        loading={update.isPending}
        onPress={() =>
          update.mutate({
            wakeTimeMinutes: Number(wakeTimeMinutes[0]),
            eveningTimeMinutes: Number(eveningTimeMinutes[0]),
          })
        }
      />
      {saved && !update.isPending && (
        <View style={shared.successBanner}>
          <Text style={shared.success}>✓ Saved.</Text>
        </View>
      )}
      {update.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>{update.error.message}</Text>
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const { largeText, setLargeText } = useAccessibility();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Settings</Text>

      <View style={shared.card}>
        <View style={shared.switchRow}>
          <Text style={shared.subtitle}>Large text</Text>
          <Switch value={largeText} onValueChange={setLargeText} accessibilityLabel="Large text" />
        </View>
        <Text>Makes text throughout the app bigger and easier to read.</Text>
      </View>

      <NotificationTimesSection />
    </ScrollView>
  );
}
