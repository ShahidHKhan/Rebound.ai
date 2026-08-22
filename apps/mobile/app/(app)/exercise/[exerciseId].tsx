import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";

import { Button } from "../../../components/Button";
import { unwrap } from "../../../lib/rest/api-error";
import { useApi } from "../../../lib/rest/ApiProvider";
import { qk } from "../../../lib/rest/query-keys";
import { useSharedStyles } from "../../../lib/styles";

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// The Free Exercise DB seed script (packages/db/scripts/seed-exercises.ts)
// stores media as { instructions: string[], images: string[] } — but media
// is a nullable Json column with no schema guarantee, so this reads it
// defensively rather than trusting the shape.
function readMedia(media: unknown): { instructions: string[]; images: string[] } {
  if (!media || typeof media !== "object") return { instructions: [], images: [] };
  const m = media as Record<string, unknown>;
  const instructions = Array.isArray(m.instructions)
    ? m.instructions.filter((i): i is string => typeof i === "string")
    : [];
  const images = Array.isArray(m.images) ? m.images.filter((i): i is string => typeof i === "string") : [];
  return { instructions, images };
}

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const api = useApi();
  const exerciseQuery = useQuery({
    queryKey: qk.exercise(exerciseId),
    queryFn: async () => unwrap(await api.GET("/exercises/{exerciseId}", { params: { path: { exerciseId } } })),
  });

  if (exerciseQuery.isLoading) {
    return (
      <View style={shared.centeredPage}>
        <ActivityIndicator />
        <Text>Loading exercise…</Text>
      </View>
    );
  }

  if (exerciseQuery.isError || !exerciseQuery.data) {
    return (
      <View style={shared.centeredPage}>
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load this exercise: {exerciseQuery.error?.message}</Text>
        </View>
        <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const exercise = exerciseQuery.data;
  const { instructions, images } = readMedia(exercise.media);

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>{exercise.name}</Text>

      <View style={shared.card}>
        <Text>
          <Text style={shared.label}>Category: </Text>
          {exercise.category.toLowerCase()}
        </Text>
        <Text>
          <Text style={shared.label}>Difficulty: </Text>
          {exercise.difficultyLevel}
        </Text>
        {exercise.targetMuscleGroups.length > 0 && (
          <View>
            <Text style={shared.label}>Target muscle groups</Text>
            <View style={shared.row}>
              {exercise.targetMuscleGroups.map((m) => (
                <View key={m} style={shared.chip}>
                  <Text style={shared.chipText}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {exercise.contraindications.length > 0 && (
          <View>
            <Text style={shared.label}>Contraindications</Text>
            <View style={shared.row}>
              {exercise.contraindications.map((c) => (
                <View key={c} style={shared.chip}>
                  <Text style={shared.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {images.length > 0 && (
        <View style={shared.card}>
          {images.map((img) => (
            <Image
              key={img}
              source={{ uri: `${IMAGE_BASE}${img}` }}
              style={{ width: "100%", aspectRatio: 1.33, borderRadius: 8, marginBottom: 8 }}
              resizeMode="contain"
            />
          ))}
        </View>
      )}

      {instructions.length > 0 && (
        <View style={shared.card}>
          <Text style={shared.subtitle}>Instructions</Text>
          {instructions.map((step, i) => (
            <Text key={i}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      )}

      <Text style={{ color: "#666", fontSize: 12 }}>Source: {exercise.source}</Text>
    </ScrollView>
  );
}
