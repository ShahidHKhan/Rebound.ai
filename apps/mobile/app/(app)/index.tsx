import { useAuth } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../../components/Button";
import { trpc } from "../../lib/trpc";
import { useSharedStyles } from "../../lib/styles";
import { syncDailyNotifications, type TodayData } from "../../lib/notifications";

type SessionSlot = "MORNING" | "EVENING";

function DeleteAccountSection() {
  const { signOut } = useAuth();
  const shared = useSharedStyles();

  const deleteAccount = trpc.user.deleteMyAccount.useMutation({
    onSuccess: () => signOut(),
  });

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, regimes, and session history. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteAccount.mutate() },
      ]
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Button
        label={deleteAccount.isPending ? "Deleting…" : "Delete my account"}
        variant="secondary"
        loading={deleteAccount.isPending}
        onPress={confirmDelete}
      />
      {deleteAccount.isError && (
        <View style={shared.errorBanner}>
          <Text style={shared.error}>{deleteAccount.error.message}</Text>
        </View>
      )}
    </View>
  );
}

function SessionCard({
  slot,
  label,
  data,
  onComplete,
  completing,
}: {
  slot: SessionSlot;
  label: string;
  data: TodayData;
  onComplete: (workoutSessionId: string) => void;
  completing: boolean;
}) {
  const shared = useSharedStyles();

  if (!data.regime) return null;

  const session = data.sessions.find((s) => s.slot === slot);
  const exercises = data.regime.exerciseList.filter((e) => e.sessionSlot === slot);

  return (
    <View style={shared.card}>
      <Text style={shared.subtitle}>{label}</Text>
      {exercises.map((e) => (
        <Text key={e.exerciseId}>
          {"• "}
          <Link href={`/exercise/${e.exerciseId}`} style={shared.link}>
            {e.exercise.name}
          </Link>
          {e.sets && e.reps ? ` — ${e.sets}×${e.reps}` : ""}
          {e.durationSeconds ? ` — ${e.durationSeconds}s` : ""}
        </Text>
      ))}
      {session?.completedAt ? (
        <Text>Completed at {session.completedAt.toLocaleTimeString()}</Text>
      ) : (
        <Button
          label="Mark session complete"
          variant="secondary"
          disabled={!session}
          loading={completing}
          onPress={() => session && onComplete(session.id)}
        />
      )}
    </View>
  );
}

const TRIGGER_LABEL: Record<string, string> = {
  SCHEDULED_ADJUSTMENT: "Scheduled adjustment",
  ESCALATION_ROLLBACK: "Escalation rollback",
};

// Promotes the hold/rollback banner (transient, shown only right after a
// sessionLog.create call above) into a revisitable "what changed and why"
// moment — surfaced whenever the active regime isn't the original version.
function AdjustmentExplainer({ regimeId, versionNumber }: { regimeId: string; versionNumber: number }) {
  const shared = useSharedStyles();
  const eventsQuery = trpc.adjustmentEvent.list.useQuery();

  if (versionNumber <= 1) return null;
  if (!eventsQuery.data) return null;

  const latestEvent = eventsQuery.data.find((e) => e.toRegimeVersionId === regimeId);
  if (!latestEvent) return null;

  return (
    <View style={shared.card}>
      <Text style={shared.subtitle}>Your plan changed</Text>
      <Text>
        v{latestEvent.fromRegime.versionNumber} → v{latestEvent.toRegime.versionNumber} —{" "}
        {TRIGGER_LABEL[latestEvent.triggerType] ?? latestEvent.triggerType}
      </Text>
      <Text style={{ color: "#666", fontSize: 12 }}>{new Date(latestEvent.triggeredAt).toLocaleString()}</Text>
      <Text>{latestEvent.rationale}</Text>
      <Link href="/adjustments" style={shared.link}>
        See full history →
      </Link>
    </View>
  );
}

export default function HomeScreen() {
  const { signOut } = useAuth();
  const shared = useSharedStyles();
  const utils = trpc.useUtils();
  const today = trpc.workoutSession.today.useQuery();

  const completeSession = trpc.workoutSession.complete.useMutation({
    onSuccess: () => utils.workoutSession.today.invalidate(),
  });

  const [painScore, setPainScore] = useState("0");
  const [madeItWorse, setMadeItWorse] = useState(false);
  const [perceivedExertion, setPerceivedExertion] = useState("");
  const [logResult, setLogResult] = useState<{ action: string; reasons: string[] } | null>(null);

  const logSession = trpc.sessionLog.create.useMutation({
    onSuccess: (result) => {
      setLogResult({ action: result.escalation.action, reasons: result.escalation.reasons });
      utils.workoutSession.today.invalidate();
    },
  });

  useEffect(() => {
    if (today.data === undefined) return; // still loading — don't cancel anything yet
    const sessions = today.data.regime ? today.data.sessions : [];

    syncDailyNotifications(sessions);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncDailyNotifications(sessions);
    });
    return () => subscription.remove();
  }, [today.data]);

  if (today.isLoading) {
    return (
      <View style={shared.centeredPage}>
        <ActivityIndicator />
        <Text>Loading…</Text>
      </View>
    );
  }

  if (today.isError) {
    return (
      <View style={shared.centeredPage}>
        <View style={shared.errorBanner}>
          <Text style={shared.error}>Couldn&apos;t load today&apos;s sessions: {today.error.message}</Text>
        </View>
      </View>
    );
  }

  if (!today.data?.regime) {
    return (
      <View style={shared.centeredPage}>
        <Text style={shared.title}>Rebound.ai</Text>
        <Text>You don&apos;t have an active regime yet.</Text>
        <Link href="/onboarding" style={[shared.secondaryButton, shared.secondaryButtonText, { textAlign: "center" }]}>
          Start onboarding →
        </Link>
        <Link href="/settings" style={[shared.secondaryButton, shared.secondaryButtonText, { textAlign: "center" }]}>
          Settings
        </Link>
        <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
        <DeleteAccountSection />
      </View>
    );
  }

  const data = today.data;

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Text style={shared.title}>Today</Text>
      <Text style={{ color: "#666" }}>Regime v{data.regime.versionNumber}</Text>
      <Text>{data.streak > 0 ? `${data.streak}-day streak` : "No streak yet — complete a session to start one"}</Text>

      <AdjustmentExplainer regimeId={data.regime.id} versionNumber={data.regime.versionNumber} />

      <SessionCard
        slot="MORNING"
        label="Morning"
        data={data}
        completing={completeSession.isPending}
        onComplete={(id) => completeSession.mutate({ workoutSessionId: id })}
      />
      <SessionCard
        slot="EVENING"
        label="Evening"
        data={data}
        completing={completeSession.isPending}
        onComplete={(id) => completeSession.mutate({ workoutSessionId: id })}
      />

      <View style={shared.card}>
        <Text style={shared.subtitle}>Daily check-in</Text>
        {data.todaysLog || logResult ? (
          <>
            {logResult?.action === "rollback" ? (
              <View style={shared.errorBanner}>
                <Text style={shared.alert}>
                  Stop &amp; consult a professional. Your regime has been rolled back based on today&apos;s log.{" "}
                  {logResult.reasons.join(" ")}
                </Text>
              </View>
            ) : logResult?.action === "hold" || logResult?.action === "flag_for_review" ? (
              <View style={shared.errorBanner}>
                <Text style={shared.error}>
                  We&apos;re keeping a closer eye on your recent trend. {logResult.reasons.join(" ")}
                </Text>
              </View>
            ) : logResult ? (
              <View style={shared.successBanner}>
                <Text style={shared.success}>✓ Logged for today.</Text>
              </View>
            ) : (
              <Text>You&apos;ve already logged today.</Text>
            )}
          </>
        ) : (
          <>
            <Text style={shared.label}>Pain (0 = none, 10 = worst)</Text>
            <TextInput style={shared.input} keyboardType="number-pad" value={painScore} onChangeText={setPainScore} />

            <Button
              label={madeItWorse ? "✓ This made it worse" : "This made it worse"}
              variant={madeItWorse ? "primary" : "secondary"}
              onPress={() => setMadeItWorse((v) => !v)}
            />

            <Text style={shared.label}>Perceived exertion (optional, 0-10)</Text>
            <TextInput
              style={shared.input}
              keyboardType="number-pad"
              value={perceivedExertion}
              onChangeText={setPerceivedExertion}
            />

            <Button
              label="Log today"
              loading={logSession.isPending}
              onPress={() =>
                logSession.mutate({
                  painScore: Number(painScore),
                  flag: madeItWorse,
                  perceivedExertion: perceivedExertion === "" ? undefined : Number(perceivedExertion),
                })
              }
            />
            {logSession.isError && (
              <View style={shared.errorBanner}>
                <Text style={shared.error}>{logSession.error.message}</Text>
              </View>
            )}
          </>
        )}
      </View>

      <Link href="/history" style={[shared.secondaryButton, shared.secondaryButtonText, { textAlign: "center" }]}>
        History
      </Link>
      <Link href="/settings" style={[shared.secondaryButton, shared.secondaryButtonText, { textAlign: "center" }]}>
        Settings
      </Link>
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
      <DeleteAccountSection />
    </ScrollView>
  );
}
