import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { trpc } from "../../lib/trpc";
import { useSharedStyles } from "../../lib/styles";

const TRIGGER_LABEL: Record<string, string> = {
  SCHEDULED_ADJUSTMENT: "Scheduled adjustment",
  ESCALATION_ROLLBACK: "Escalation rollback",
};

export default function AdjustmentsScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const eventsQuery = trpc.adjustmentEvent.list.useQuery();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Adjustment history</Text>
      <Text>
        Every time your plan changed — whether from a scheduled weekly review or a safety rollback — and why.
      </Text>

      {eventsQuery.isLoading && (
        <View style={shared.row}>
          <ActivityIndicator />
          <Text>Loading…</Text>
        </View>
      )}
      {eventsQuery.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load your adjustment history: {eventsQuery.error.message}</Text>
        </View>
      )}
      {eventsQuery.data && eventsQuery.data.length === 0 && (
        <Text>No adjustments yet — your plan hasn&apos;t changed since it was created.</Text>
      )}
      {eventsQuery.data?.map((event) => (
        <View key={event.id} style={shared.card}>
          <Text style={shared.subtitle}>
            v{event.fromRegime.versionNumber} → v{event.toRegime.versionNumber}
          </Text>
          <Text>{TRIGGER_LABEL[event.triggerType] ?? event.triggerType}</Text>
          <Text style={{ color: "#666", fontSize: 12 }}>{new Date(event.triggeredAt).toLocaleString()}</Text>
          <Text>{event.rationale}</Text>
          {event.wasReversed && (
            <View style={shared.errorBanner}>
              <Text style={shared.error}>Later reversed</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
