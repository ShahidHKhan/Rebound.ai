import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { unwrap } from "../../lib/rest/api-error";
import { useApi } from "../../lib/rest/ApiProvider";
import { qk } from "../../lib/rest/query-keys";
import { useSharedStyles } from "../../lib/styles";

export default function BillingScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const api = useApi();
  const me = useQuery({
    queryKey: qk.me(),
    queryFn: async () => unwrap(await api.GET("/users/me")),
  });

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Subscription & Billing</Text>

      <View style={shared.card}>
        {me.isLoading && <ActivityIndicator />}
        {me.isError && (
          <View style={shared.errorBanner}>
            <Text style={shared.error}>Couldn&apos;t load your billing status: {me.error.message}</Text>
          </View>
        )}
        {me.data && (
          <>
            <Text style={shared.subtitle}>Status</Text>
            {me.data.billing.trialActive ? (
              <View style={shared.successBanner}>
                <Text style={shared.success}>
                  You&apos;re in your free trial — full access through your first plan adjustment.
                </Text>
              </View>
            ) : (
              <View style={shared.successBanner}>
                <Text style={shared.success}>
                  Your plan had its first automatic adjustment on{" "}
                  {new Date(me.data.billing.firstAdjustmentAt!).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  — subscription billing isn&apos;t live yet, so you keep full access during the beta at no charge.
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Paywall/upgrade preview — page-map spec: surfaced only at the
          natural trigger point (first Flow B adjustment), never as a
          blocking interstitial elsewhere in the app. */}
      {me.data && !me.data.billing.trialActive && (
        <View style={shared.card}>
          <Text style={shared.subtitle}>Rebound.ai is launching paid plans soon</Text>
          <Text>
            You&apos;ll keep full access through the beta at no charge — we&apos;ll notify you before anything
            changes, well ahead of any billing start date.
          </Text>
          <Button label="Notify me when pricing is announced" variant="secondary" disabled onPress={() => {}} />
        </View>
      )}

      <Button label="Cancel my plan" variant="secondary" onPress={() => router.push("/cancel")} />
    </ScrollView>
  );
}
