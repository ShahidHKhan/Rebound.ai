import { Link, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { trpc } from "../../lib/trpc";
import { useSharedStyles } from "../../lib/styles";

export default function HistoryScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const logsQuery = trpc.sessionLog.list.useQuery();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>History</Text>
      <Text>Your past daily check-ins — pain score, exertion, and flags over time.</Text>
      <Link href="/adjustments" style={shared.link}>
        See adjustment history →
      </Link>

      {logsQuery.isLoading && (
        <View style={shared.row}>
          <ActivityIndicator />
          <Text>Loading…</Text>
        </View>
      )}
      {logsQuery.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load your history: {logsQuery.error.message}</Text>
        </View>
      )}
      {logsQuery.data && logsQuery.data.length === 0 && <Text>No check-ins logged yet.</Text>}
      {logsQuery.data?.map((log) => (
        <View key={log.id} style={shared.card}>
          <Text style={shared.subtitle}>{new Date(log.loggedAt).toLocaleDateString()}</Text>
          <Text>Pain: {log.painScore}/10</Text>
          <Text>Perceived exertion: {log.perceivedExertion ?? "—"}</Text>
          <Text>Made it worse: {log.flag ? "Yes" : "No"}</Text>
          <Text>Completed: {log.completed ? "Yes" : "No"}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
