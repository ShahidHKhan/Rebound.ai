import { useRouter } from "expo-router";
import { Linking, ScrollView, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { useSharedStyles } from "../../lib/styles";

// Legal/marketing pages live on apps/web — linked out to rather than
// duplicated as native screens. Same fallback pattern as (auth)/sign-up.tsx
// and settings.tsx.
const WEB_APP_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function HelpScreen() {
  const router = useRouter();
  const shared = useSharedStyles();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Help & FAQ</Text>

      <View style={shared.card}>
        <Text style={shared.subtitle}>How does the AI plan work?</Text>
        <Text>
          When you finish onboarding, an AI model drafts a personalized exercise regime from your stated goal and
          health questionnaire answers. As you log sessions and daily pain check-ins, the same system periodically
          reviews your recent trend and can adjust your plan — holding it steady, progressing it, or rolling it
          back — based on how you&apos;re actually responding, not a fixed schedule.
        </Text>
      </View>

      <View style={shared.card}>
        <Text style={shared.subtitle}>Is this safe? What if something hurts?</Text>
        <Text>
          Rebound.ai screens for clinical red flags during onboarding and monitors your daily check-ins for signs a
          session made things worse. If you ever feel sharp, severe, or worsening pain, stop the exercise and
          consult a medical professional — the app is not a substitute for that.
        </Text>
        <Text style={shared.link} onPress={() => Linking.openURL(`${WEB_APP_URL}/safety`)}>
          Safety &amp; Guardrails →
        </Text>
      </View>

      <View style={shared.card}>
        <Text style={shared.subtitle}>How do I change my reminder times?</Text>
        <Text>
          Your morning and evening session times are set during onboarding and used to schedule your twice-daily
          reminders. If reminder-time editing isn&apos;t available yet in your version of the app, it&apos;s on the
          roadmap — for now, redoing onboarding also lets you resubmit your preferred times.
        </Text>
      </View>

      <View style={shared.card}>
        <Text style={shared.subtitle}>How do I cancel?</Text>
        <Text>
          Rebound.ai is completely free during the beta — there is no subscription to cancel yet. You can preview
          what the future cancellation flow will look like from Settings → Cancel plan, but nothing about your
          access changes when you use it. If you&apos;d like to stop using the app entirely and remove your data,
          use &quot;Delete my account&quot; in Settings instead.
        </Text>
        <Button label="Preview cancellation" variant="secondary" onPress={() => router.push("/cancel")} />
      </View>

      <View style={shared.card}>
        <Text style={shared.subtitle}>What happens to my data?</Text>
        <Text>See our Privacy Policy for the full details on what we collect and how to permanently delete your account.</Text>
        <Text style={shared.link} onPress={() => Linking.openURL(`${WEB_APP_URL}/privacy`)}>
          Privacy Policy →
        </Text>
      </View>
    </ScrollView>
  );
}
