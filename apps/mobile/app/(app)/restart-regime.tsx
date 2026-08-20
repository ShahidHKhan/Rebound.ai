import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/ChipGroup";
import { trpc } from "../../lib/trpc";
import { useSharedStyles } from "../../lib/styles";

type ReasonCode = "GOALS_CHANGED" | "STARTING_OVER" | "OTHER";

const REASON_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: "GOALS_CHANGED", label: "My goals changed" },
  { value: "STARTING_OVER", label: "I want to start over" },
  { value: "OTHER", label: "Other" },
];

export default function RestartRegimeScreen() {
  const router = useRouter();
  const shared = useSharedStyles();

  const [reasonCode, setReasonCode] = useState<ReasonCode[]>([]);
  const [comment, setComment] = useState("");

  const restart = trpc.regime.restart.useMutation();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Restart your regime</Text>

      <View style={shared.errorBanner}>
        <Text style={shared.error}>
          This ends your current active regime — it stays in your history but stops being your daily plan.
          You&apos;ll go straight to onboarding to build a new one.
        </Text>
      </View>

      {restart.isSuccess ? (
        <View style={shared.card}>
          <View style={shared.successBanner}>
            <Text style={shared.success}>Your regime has been ended.</Text>
          </View>
          <Button label="Build your new regime →" onPress={() => router.replace("/onboarding")} />
        </View>
      ) : (
        <View style={shared.card}>
          <Text style={shared.label}>Why are you restarting?</Text>
          <ChipGroup options={REASON_OPTIONS} selected={reasonCode} onToggle={(v) => setReasonCode([v])} />

          <Text style={shared.label}>Anything else you&apos;d like to add? (optional)</Text>
          <TextInput
            style={[shared.input, { minHeight: 80 }]}
            multiline
            maxLength={1000}
            value={comment}
            onChangeText={setComment}
          />

          <Button
            label="Restart regime"
            loading={restart.isPending}
            disabled={reasonCode.length === 0}
            onPress={() => {
              const code = reasonCode[0];
              if (!code) return;
              restart.mutate({ reasonCode: code, comment: comment.trim() === "" ? undefined : comment.trim() });
            }}
          />
          {restart.isError && (
            <View style={shared.errorBanner}>
              <Text style={shared.error}>{restart.error.message}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
