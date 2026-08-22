import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../../components/Button";
import { unwrap } from "../../../lib/rest/api-error";
import { useApi } from "../../../lib/rest/ApiProvider";
import { qk } from "../../../lib/rest/query-keys";
import type { components } from "../../../lib/rest/schema";
import { useSharedStyles } from "../../../lib/styles";

type Summary = components["schemas"]["ProgressSummary"];
type PainPoint = Summary["painTrend"][number];

const CHART_HEIGHT = 100;
const BAR_COLOR = "#2563eb";
// Most recent N days shown as bars — full 60-day trend is available via the
// web Progress dashboard; mobile keeps this to what comfortably fits one
// screen width without needing a scrollable chart.
const MAX_BARS = 14;

function StatTile({ value, label }: { value: string; label: string }) {
  const shared = useSharedStyles();
  return (
    <View style={[shared.card, { flex: 1, marginBottom: 0 }]}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: "#666", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

// Pain trend — no SVG/chart library available on mobile (no new
// dependencies allowed), so this renders the same "magnitude over time"
// idea as a plain flexbox bar chart: one identity color, baseline-anchored
// bars, thin gaps — same spirit as the dataviz skill's mark spec, built
// from Views instead of <svg>. The web Progress dashboard has the full
// line-chart version of the same data.
function PainTrendBars({ painTrend }: { painTrend: PainPoint[] }) {
  const shared = useSharedStyles();

  if (painTrend.length === 0) {
    return <Text style={{ opacity: 0.7 }}>No pain check-ins logged yet.</Text>;
  }

  const recent = painTrend.slice(-MAX_BARS);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: CHART_HEIGHT }}>
        {recent.map((p) => (
          <View key={p.date} style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                width: "100%",
                height: Math.max(4, (p.painScore / 10) * CHART_HEIGHT),
                backgroundColor: BAR_COLOR,
                borderRadius: 3,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={shared.label}>{recent[0].date}</Text>
        <Text style={shared.label}>pain 0–10</Text>
        <Text style={shared.label}>{recent[recent.length - 1].date}</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const api = useApi();
  const summary = useQuery({
    queryKey: qk.progressSummary(),
    queryFn: async () => unwrap(await api.GET("/progress/summary")),
  });

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Progress</Text>
      <Text>How you&apos;re doing, at a glance.</Text>

      {summary.isLoading && <ActivityIndicator />}

      {summary.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load your progress: {summary.error.message}</Text>
        </View>
      )}

      {summary.data && (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatTile
              value={summary.data.adherencePct === null ? "—" : `${summary.data.adherencePct}%`}
              label="Adherence"
            />
            <StatTile value={String(summary.data.weeksActive)} label="Weeks active" />
            <StatTile value={String(summary.data.streak)} label="Day streak" />
          </View>

          <View style={shared.card}>
            <Text style={shared.subtitle}>Pain trend</Text>
            <PainTrendBars painTrend={summary.data.painTrend} />
          </View>

          <Link
            href="/progress/streak"
            style={[shared.secondaryButton, shared.secondaryButtonText, { textAlign: "center" }]}
          >
            See your streak calendar →
          </Link>
          <Link
            href="/progress/milestones"
            style={[shared.secondaryButton, shared.secondaryButtonText, { textAlign: "center" }]}
          >
            See your milestones →
          </Link>
        </>
      )}
    </ScrollView>
  );
}
