import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../../components/Button";
import { trpc } from "../../../lib/trpc";
import { useSharedStyles } from "../../../lib/styles";

export default function MilestonesScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const milestones = trpc.progress.milestones.useQuery();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Milestones</Text>
      <Text>Achievements based on your activity so far — nothing to unlock or buy.</Text>

      {milestones.isLoading && <ActivityIndicator />}

      {milestones.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load your milestones: {milestones.error.message}</Text>
        </View>
      )}

      {milestones.data && milestones.data.length === 0 && (
        <Text style={{ opacity: 0.7 }}>No milestones yet — keep going, your first one is close.</Text>
      )}

      {milestones.data?.map((m) => (
        <View key={m.id} style={shared.card}>
          <Text style={shared.subtitle}>🏅 {m.label}</Text>
          <Text style={{ color: "#666" }}>{m.description}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
