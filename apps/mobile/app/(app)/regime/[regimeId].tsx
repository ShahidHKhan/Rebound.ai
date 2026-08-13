import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@rebound/api";

import { Button } from "../../../components/Button";
import { ChipGroup } from "../../../components/ChipGroup";
import { trpc } from "../../../lib/trpc";
import { shared } from "../../../lib/styles";

type RegimeData = inferRouterOutputs<AppRouter>["regime"]["getById"];
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
  const { regimeId } = useLocalSearchParams<{ regimeId: string }>();
  const regimeQuery = trpc.regime.getById.useQuery({ regimeId });
  const [exercises, setExercises] = useState<EditableExercise[] | null>(null);
  const [activated, setActivated] = useState<{ exerciseCount: number } | null>(null);
  const [seededFrom, setSeededFrom] = useState<typeof regimeQuery.data>(undefined);

  if (regimeQuery.data && regimeQuery.data !== seededFrom) {
    setSeededFrom(regimeQuery.data);
    setExercises(toEditable(regimeQuery.data));
  }

  const activate = trpc.regime.activate.useMutation({
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

    activate.mutate({ regimeId, exercises: changed ? current : undefined });
  }

  if (activated) {
    return (
      <View style={shared.centeredPage}>
        <Text style={shared.title}>Regime activated</Text>
        <Text>{activated.exerciseCount} exercises are now live, split across morning and evening sessions.</Text>
      </View>
    );
  }

  if (regimeQuery.isLoading || !exercises) {
    return (
      <View style={shared.centeredPage}>
        <Text>Loading regime…</Text>
      </View>
    );
  }

  if (regimeQuery.isError) {
    return (
      <View style={shared.centeredPage}>
        <Text style={shared.error}>Couldn&apos;t load this regime: {regimeQuery.error.message}</Text>
      </View>
    );
  }

  const morning = exercises.filter((e) => e.sessionSlot === "MORNING");
  const evening = exercises.filter((e) => e.sessionSlot === "EVENING");

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Text style={shared.title}>Review your regime</Text>
      <Text>Adjust sets, reps, duration, or which session an exercise falls in, then activate.</Text>

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
                {exercise.name} ({exercise.category.toLowerCase()})
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

      <Button label={activate.isPending ? "Activating…" : "Activate regime"} onPress={handleActivate} disabled={activate.isPending} />
      {activate.isError && <Text style={shared.error}>{activate.error.message}</Text>}
    </ScrollView>
  );
}
