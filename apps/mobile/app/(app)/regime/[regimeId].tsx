import { useMutation, useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../../../components/Button";
import { ChipGroup } from "../../../components/ChipGroup";
import { unwrap } from "../../../lib/rest/api-error";
import { useApi } from "../../../lib/rest/ApiProvider";
import type { components } from "../../../lib/rest/schema";
import { useSharedStyles } from "../../../lib/styles";

// Notification permission primer: shown once, before the OS permission
// dialog fires naturally on Home's first mount (see lib/notifications.ts's
// syncDailyNotifications, called from HomeScreen). Same expo-secure-store
// persistence pattern as lib/accessibility.tsx's `largeText` preference.
const NOTIFICATION_PRIMER_SEEN_KEY = "rebound.notificationPrimerSeen";

type RegimeData = components["schemas"]["Regime"];
type SessionSlot = "MORNING" | "EVENING";

interface EditableExercise {
  exerciseId: string;
  name: string;
  category: string;
  sets: number | undefined;
  reps: number | undefined;
  durationSeconds: number | undefined;
  frequency: string | undefined;
  sessionSlot: SessionSlot;
}

function toEditable(data: RegimeData): EditableExercise[] {
  return data.exerciseList.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.exercise.name,
    category: e.exercise.category,
    sets: e.sets ?? undefined,
    reps: e.reps ?? undefined,
    durationSeconds: e.durationSeconds ?? undefined,
    frequency: e.frequency ?? undefined,
    sessionSlot: e.sessionSlot,
  }));
}

function toComparablePayload(exercises: EditableExercise[]) {
  return exercises.map(({ exerciseId, sets, reps, durationSeconds, frequency, sessionSlot }) => ({
    exerciseId,
    sets,
    reps,
    durationSeconds,
    frequency,
    sessionSlot,
  }));
}

const SLOT_OPTIONS: { value: SessionSlot; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "EVENING", label: "Evening" },
];

export default function RegimeReviewScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const { regimeId } = useLocalSearchParams<{ regimeId: string }>();
  const api = useApi();
  const regimeQuery = useQuery({
    queryKey: ["regimes", regimeId],
    queryFn: async () => unwrap(await api.GET("/regimes/{regimeId}", { params: { path: { regimeId } } })),
  });
  const [exercises, setExercises] = useState<EditableExercise[] | null>(null);
  const [activated, setActivated] = useState<{ exerciseCount: number } | null>(null);
  const [seededFrom, setSeededFrom] = useState<typeof regimeQuery.data>(undefined);
  const [showNotificationPrimer, setShowNotificationPrimer] = useState(false);

  if (regimeQuery.data && regimeQuery.data !== seededFrom) {
    setSeededFrom(regimeQuery.data);
    setExercises(toEditable(regimeQuery.data));
  }

  const activate = useMutation({
    mutationFn: async (exercises: ReturnType<typeof toComparablePayload> | undefined) =>
      unwrap(
        await api.POST("/regimes/{regimeId}/activate", {
          params: { path: { regimeId } },
          body: { exercises },
        })
      ),
    onSuccess: (result) => setActivated(result),
  });

  function updateExercise(exerciseId: string, patch: Partial<EditableExercise>) {
    setExercises((prev) => prev?.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e)) ?? null);
  }

  function handleActivate() {
    if (!exercises || !regimeQuery.data) return;

    const original = toComparablePayload(toEditable(regimeQuery.data));
    const current = toComparablePayload(exercises);
    const changed = JSON.stringify(original) !== JSON.stringify(current);

    activate.mutate(changed ? current : undefined);
  }

  // Only the very first regime a user ever activates should interrupt with
  // the primer — gated on versionNumber === 1 AND the "seen" flag being
  // unset, so later regime activations (Flow B adjustments, restarts) go
  // straight to Home like today. Purely explanatory framing; the actual OS
  // permission dialog still fires naturally on Home's next mount via
  // syncDailyNotifications, untouched here.
  async function handleGoToSessions() {
    const isFirstRegime = regimeQuery.data?.versionNumber === 1;
    if (isFirstRegime) {
      const alreadySeen = await SecureStore.getItemAsync(NOTIFICATION_PRIMER_SEEN_KEY);
      if (alreadySeen !== "true") {
        setShowNotificationPrimer(true);
        return;
      }
    }
    router.replace("/");
  }

  function handlePrimerContinue() {
    SecureStore.setItemAsync(NOTIFICATION_PRIMER_SEEN_KEY, "true").catch(() => {});
    router.replace("/");
  }

  if (activated) {
    if (showNotificationPrimer) {
      return (
        <View style={shared.centeredPage}>
          <Text style={shared.title}>Two daily reminders</Text>
          <Text>
            To help the habit stick, Rebound.ai sends two reminders a day — one around your wake time, one in
            the evening — nudging you toward your morning and evening sessions.
          </Text>
          <Text>
            Next you&apos;ll see a system prompt asking to allow notifications — allow it so reminders can reach
            you. You can turn this off anytime from Settings.
          </Text>
          <Button label="Continue" onPress={handlePrimerContinue} />
        </View>
      );
    }

    return (
      <View style={shared.centeredPage}>
        <Text style={shared.title}>Regime activated</Text>
        <View style={shared.successBanner}>
          <Text style={shared.success}>
            ✓ {activated.exerciseCount} exercises are now live, split across morning and evening sessions.
          </Text>
        </View>
        <Button label="Go to today's sessions →" onPress={handleGoToSessions} />
      </View>
    );
  }

  if (regimeQuery.isLoading || !exercises) {
    return (
      <View style={shared.centeredPage}>
        <ActivityIndicator />
        <Text>Loading regime…</Text>
      </View>
    );
  }

  if (regimeQuery.isError) {
    return (
      <View style={shared.centeredPage}>
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load this regime: {regimeQuery.error.message}</Text>
        </View>
        <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const morning = exercises.filter((e) => e.sessionSlot === "MORNING");
  const evening = exercises.filter((e) => e.sessionSlot === "EVENING");

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Review your regime</Text>
      <Text>Adjust sets, reps, duration, or which session an exercise falls in, then activate.</Text>

      {regimeQuery.data?.sourcePreset && (
        <View style={shared.card}>
          <Text style={shared.label}>Program source</Text>
          <Text>Based on the &ldquo;{regimeQuery.data.sourcePreset.name}&rdquo; protocol.</Text>
          {[...new Set(regimeQuery.data.sourcePreset.slots.map((slot) => slot.rationale).filter((r): r is string => Boolean(r)))].map(
            (rationale) => (
              <Text key={rationale} style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
                • {rationale}
              </Text>
            )
          )}
        </View>
      )}

      {([
        ["Morning", morning],
        ["Evening", evening],
      ] as const).map(([label, group]) => (
        <View key={label}>
          <Text style={shared.subtitle}>{label}</Text>
          {group.length === 0 && <Text>No exercises assigned.</Text>}
          {group.map((exercise) => (
            <View key={exercise.exerciseId} style={shared.card}>
              <Text style={{ fontWeight: "700" }}>
                <Link href={`/exercise/${exercise.exerciseId}`} style={shared.link}>
                  {exercise.name}
                </Link>{" "}
                ({exercise.category.toLowerCase()})
              </Text>

              <Text style={shared.label}>Sets</Text>
              <TextInput
                style={shared.input}
                keyboardType="number-pad"
                value={exercise.sets?.toString() ?? ""}
                onChangeText={(v) => updateExercise(exercise.exerciseId, { sets: v === "" ? undefined : Number(v) })}
              />

              <Text style={shared.label}>Reps</Text>
              <TextInput
                style={shared.input}
                keyboardType="number-pad"
                value={exercise.reps?.toString() ?? ""}
                onChangeText={(v) => updateExercise(exercise.exerciseId, { reps: v === "" ? undefined : Number(v) })}
              />

              <Text style={shared.label}>Duration (s)</Text>
              <TextInput
                style={shared.input}
                keyboardType="number-pad"
                value={exercise.durationSeconds?.toString() ?? ""}
                onChangeText={(v) =>
                  updateExercise(exercise.exerciseId, { durationSeconds: v === "" ? undefined : Number(v) })
                }
              />

              <Text style={shared.label}>Slot</Text>
              <ChipGroup
                options={SLOT_OPTIONS}
                selected={[exercise.sessionSlot]}
                onToggle={(v) => updateExercise(exercise.exerciseId, { sessionSlot: v })}
              />
            </View>
          ))}
        </View>
      ))}

      <Button label="Activate regime" onPress={handleActivate} loading={activate.isPending} />
      {activate.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>{activate.error.message}</Text>
        </View>
      )}
    </ScrollView>
  );
}
