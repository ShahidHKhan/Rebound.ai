import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from "react-native";

import { Button } from "../../../components/Button";
import { unwrap } from "../../../lib/rest/api-error";
import { useApi } from "../../../lib/rest/ApiProvider";
import { qk } from "../../../lib/rest/query-keys";
import { useSharedStyles } from "../../../lib/styles";
import type { TodayData } from "../../../lib/notifications";

type Slot = "MORNING" | "EVENING";
type RegimeExerciseItem = NonNullable<TodayData["regime"]>["exerciseList"][number];

// Client-side default — v1 has no per-exercise rest duration authored by
// Flow A/B (that would need LLM prompt + clinical-rules changes, out of
// scope here). Advisory only: it never blocks "Complete set"/"Next".
const REST_SECONDS = 30;

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Header row shared by every card — exit + progress + elapsed timer. Exit is
// a real button, not a gesture: this is the accessible equivalent WCAG 2.5.1
// requires alongside any path-based (swipe) interaction, and it's also the
// only way to reach the confirm-and-discard flow, since swipe left/right is
// bound to card navigation instead.
function SessionHeader({
  cardLabel,
  elapsedSeconds,
  onExit,
}: {
  cardLabel: string;
  elapsedSeconds: number;
  onExit: () => void;
}) {
  const shared = useSharedStyles();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
      <Pressable onPress={onExit} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exit session">
        <Text style={[shared.error, { fontSize: 20 * 1 }]}>✕</Text>
      </Pressable>
      <Text style={shared.label}>{cardLabel}</Text>
      <Text style={shared.label}>{formatClock(elapsedSeconds)}</Text>
    </View>
  );
}

function ExerciseCard({
  exercise,
  completedSets,
  onCompleteSet,
  onGoBack,
  onGoNext,
  canGoBack,
  restSecondsLeft,
  onSkipRest,
}: {
  exercise: RegimeExerciseItem;
  completedSets: number;
  onCompleteSet: () => void;
  onGoBack: () => void;
  onGoNext: () => void;
  canGoBack: boolean;
  restSecondsLeft: number | null;
  onSkipRest: () => void;
}) {
  const shared = useSharedStyles();
  const { width } = useWindowDimensions();
  const totalSets = exercise.sets ?? 1;
  const isDurationBased = !exercise.durationSeconds ? false : true;
  const setDone = completedSets >= totalSets;

  return (
    <View style={{ width, flex: 1, padding: 16, gap: 16, justifyContent: "center" }}>
      <View style={shared.card}>
        <Text style={shared.title}>{exercise.exercise.name}</Text>
        <Text style={shared.subtitle}>
          Set {Math.min(completedSets + 1, totalSets)} of {totalSets}
        </Text>
        <Text style={shared.label}>
          {isDurationBased ? `Hold for ${exercise.durationSeconds}s` : exercise.reps ? `${exercise.reps} reps` : ""}
        </Text>

        <View style={[shared.row, { justifyContent: "center", marginVertical: 12 }]}>
          {Array.from({ length: totalSets }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: i < completedSets ? "#2563eb" : "#e5e7eb",
              }}
            />
          ))}
        </View>

        {setDone ? (
          <Button label="Next exercise →" onPress={onGoNext} />
        ) : (
          <Button label="Complete set" onPress={onCompleteSet} />
        )}

        {restSecondsLeft !== null && restSecondsLeft > 0 && (
          <View style={[shared.row, { justifyContent: "center", marginTop: 8 }]}>
            <Text style={shared.label}>⏱ Rest {formatClock(restSecondsLeft)}</Text>
            <Button label="Skip" variant="secondary" onPress={onSkipRest} />
          </View>
        )}
      </View>

      <View style={[shared.row, { justifyContent: "space-between" }]}>
        <Button label="‹ Back" variant="secondary" disabled={!canGoBack} onPress={onGoBack} />
        <Button label={setDone ? "Next ›" : "Skip ›"} variant="secondary" onPress={onGoNext} />
      </View>
    </View>
  );
}

function SummaryCard({
  exerciseCount,
  elapsedSeconds,
  onFinish,
  onGoBack,
  finishing,
  finishError,
}: {
  exerciseCount: number;
  elapsedSeconds: number;
  onFinish: () => void;
  onGoBack: () => void;
  finishing: boolean;
  finishError: string | null;
}) {
  const shared = useSharedStyles();
  const { width } = useWindowDimensions();

  return (
    <View style={{ width, flex: 1, padding: 16, gap: 16, justifyContent: "center" }}>
      <View style={shared.card}>
        <Text style={shared.title}>Session complete</Text>
        <Text>
          {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"} · {formatClock(elapsedSeconds)}
        </Text>
        <Button label="Finish session" loading={finishing} onPress={onFinish} />
        {finishError && (
          <View style={shared.errorBanner}>
            <Text style={shared.error}>{finishError}</Text>
          </View>
        )}
      </View>
      <Button label="‹ Back" variant="secondary" onPress={onGoBack} />
    </View>
  );
}

export default function GuidedSessionScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const api = useApi();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { slot } = useLocalSearchParams<{ slot: Slot }>();

  const today = useQuery({
    queryKey: qk.workoutSessionsToday(),
    queryFn: async () => unwrap(await api.GET("/workout-sessions/today")),
  });

  const listRef = useRef<FlatList>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [setsCompleted, setSetsCompleted] = useState<Record<string, number>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => Date.now());

  // Single ticking clock drives both the elapsed-time header and the rest
  // countdown — one interval, not two.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const exercises: RegimeExerciseItem[] = useMemo(() => {
    if (!today.data?.regime) return [];
    return today.data.regime.exerciseList.filter((e) => e.sessionSlot === slot);
  }, [today.data, slot]);

  const workoutSession = today.data?.sessions.find((s) => s.slot === slot);

  const completeSession = useMutation({
    mutationFn: async (durationSeconds: number) =>
      unwrap(
        await api.POST("/workout-sessions/{id}/complete", {
          params: { path: { id: workoutSession!.id } },
          body: { durationSeconds },
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.workoutSessionsToday() });
      router.replace("/");
    },
  });

  function confirmExit() {
    Alert.alert("Leave session?", "Your progress on this session won't be saved.", [
      { text: "Keep going", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => router.back() },
    ]);
  }

  // Hardware back on Android must go through the same confirm — otherwise
  // it's a silent bypass of the "confirm before discarding" requirement.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmExit();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToIndex(index: number) {
    listRef.current?.scrollToIndex({ index, animated: true });
    setCardIndex(index);
  }

  function completeSet(regimeExerciseId: string, totalSets: number) {
    setSetsCompleted((prev) => {
      const next = (prev[regimeExerciseId] ?? 0) + 1;
      if (next < totalSets) setRestEndsAt(Date.now() + REST_SECONDS * 1000);
      else setRestEndsAt(null);
      return { ...prev, [regimeExerciseId]: next };
    });
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCardIndex(first.index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  if (today.isLoading) {
    return (
      <View style={shared.centeredPage}>
        <ActivityIndicator />
        <Text>Loading…</Text>
      </View>
    );
  }

  if (today.isError || !today.data?.regime || !workoutSession || exercises.length === 0) {
    return (
      <View style={shared.centeredPage}>
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t start this session.</Text>
        </View>
        <Button label="‹ Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const elapsedSeconds = Math.floor((now - startedAt) / 1000);
  // Derived directly from now/restEndsAt rather than cleared via a separate
  // effect — an expired timer here reads as "no rest showing" on its own.
  const restSecondsLeft = restEndsAt !== null && now < restEndsAt ? Math.ceil((restEndsAt - now) / 1000) : null;
  const isSummary = cardIndex >= exercises.length;

  return (
    <View style={{ flex: 1 }}>
      <SessionHeader
        cardLabel={isSummary ? "Summary" : `Exercise ${cardIndex + 1} of ${exercises.length}`}
        elapsedSeconds={elapsedSeconds}
        onExit={confirmExit}
      />
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={[...exercises, null]}
        keyExtractor={(item, index) => item?.id ?? `summary-${index}`}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) =>
          item ? (
            <ExerciseCard
              exercise={item}
              completedSets={setsCompleted[item.id] ?? 0}
              onCompleteSet={() => completeSet(item.id, item.sets ?? 1)}
              onGoBack={() => goToIndex(index - 1)}
              onGoNext={() => goToIndex(Math.min(index + 1, exercises.length))}
              canGoBack={index > 0}
              restSecondsLeft={restSecondsLeft}
              onSkipRest={() => setRestEndsAt(null)}
            />
          ) : (
            <SummaryCard
              exerciseCount={exercises.length}
              elapsedSeconds={elapsedSeconds}
              onGoBack={() => goToIndex(exercises.length - 1)}
              onFinish={() => completeSession.mutate(elapsedSeconds)}
              finishing={completeSession.isPending}
              finishError={completeSession.isError ? completeSession.error.message : null}
            />
          )
        }
      />
    </View>
  );
}
