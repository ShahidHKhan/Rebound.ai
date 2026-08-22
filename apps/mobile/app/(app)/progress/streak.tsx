import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../../components/Button";
import { unwrap } from "../../../lib/rest/api-error";
import { useApi } from "../../../lib/rest/ApiProvider";
import { qk } from "../../../lib/rest/query-keys";
import { useSharedStyles } from "../../../lib/styles";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function StreakDetailScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const api = useApi();
  const calendar = useQuery({
    queryKey: qk.streakCalendar(),
    queryFn: async () => unwrap(await api.GET("/progress/streak-calendar")),
  });
  const todayKey = new Date().toISOString().slice(0, 10);

  const leadingBlanks = calendar.data ? new Date(calendar.data.days[0].date).getUTCDay() : 0;

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Streak calendar</Text>

      {calendar.isLoading && <ActivityIndicator />}

      {calendar.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load your streak: {calendar.error.message}</Text>
        </View>
      )}

      {calendar.data && (
        <>
          <Text style={shared.subtitle}>
            {calendar.data.streak > 0
              ? `${calendar.data.streak}-day streak`
              : "No streak yet — complete a session to start one"}
          </Text>
          <Text style={{ color: "#666", fontSize: 12 }}>
            A day counts if at least one session (morning or evening) was completed.
          </Text>

          {/* Widths sum to exactly 100% (no `gap`, which would push a 7th
              column onto the next row) — spacing comes from each cell's own
              padding instead. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text
                key={i}
                style={{ width: "14.2857%", textAlign: "center", fontSize: 10, color: "#666", paddingBottom: 4 }}
              >
                {label}
              </Text>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <View key={`blank-${i}`} style={{ width: "14.2857%", aspectRatio: 1 }} />
            ))}
            {calendar.data.days.map((day) => (
              <View
                key={day.date}
                style={{
                  width: "14.2857%",
                  aspectRatio: 1,
                  padding: 2,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 4,
                    borderWidth: day.date === todayKey ? 2 : 1,
                    borderColor: day.date === todayKey ? "#2563eb" : "#eee",
                    backgroundColor: day.completed ? "#2563eb" : "transparent",
                  }}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
