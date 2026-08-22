import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/ChipGroup";
import { unwrap } from "../../lib/rest/api-error";
import { useApi } from "../../lib/rest/ApiProvider";
import { useSharedStyles } from "../../lib/styles";

type ReasonCode =
  | "TOO_EXPENSIVE"
  | "NOT_SEEING_RESULTS"
  | "PLAN_TOO_DEMANDING"
  | "PLAN_TOO_EASY"
  | "TECHNICAL_ISSUES"
  | "OTHER";

const REASON_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "NOT_SEEING_RESULTS", label: "Not seeing results" },
  { value: "PLAN_TOO_DEMANDING", label: "Plan is too demanding" },
  { value: "PLAN_TOO_EASY", label: "Plan is too easy" },
  { value: "TECHNICAL_ISSUES", label: "Technical issues" },
  { value: "OTHER", label: "Other" },
];

export default function CancelScreen() {
  const router = useRouter();
  const shared = useSharedStyles();

  const [reasonCode, setReasonCode] = useState<ReasonCode[]>([]);
  const [comment, setComment] = useState("");

  const api = useApi();
  const submitFeedback = useMutation({
    mutationFn: async (input: { reasonCode: ReasonCode; comment?: string }) =>
      unwrap(await api.POST("/users/me/cancellation-feedback", { body: input })),
  });

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Cancel your plan</Text>

      <View style={shared.errorBanner}>
        <Text style={shared.error}>
          Billing isn&apos;t live during the beta — this previews what cancellation will look like. Submitting this
          form won&apos;t actually cancel anything; the whole app stays free and fully accessible for every beta
          user.
        </Text>
      </View>

      {submitFeedback.isSuccess ? (
        <View style={shared.card}>
          <View style={shared.successBanner}>
            <Text style={shared.success}>
              Thanks for the feedback — we&apos;ve noted it. Nothing about your access has changed; you&apos;re
              still on the full free beta.
            </Text>
          </View>
          <Button label="Back to Billing" variant="secondary" onPress={() => router.replace("/billing")} />
        </View>
      ) : (
        <View style={shared.card}>
          <Text style={shared.label}>Why are you thinking about cancelling?</Text>
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
            label="Submit feedback"
            loading={submitFeedback.isPending}
            disabled={reasonCode.length === 0}
            onPress={() => {
              const code = reasonCode[0];
              if (!code) return;
              submitFeedback.mutate({ reasonCode: code, comment: comment.trim() === "" ? undefined : comment.trim() });
            }}
          />
          {submitFeedback.isError && (
            <View style={shared.errorBanner}>
              <Text style={shared.error}>{submitFeedback.error.message}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
