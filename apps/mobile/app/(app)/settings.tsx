import { useRouter } from "expo-router";
import { Linking, ScrollView, Switch, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { useAccessibility } from "../../lib/accessibility";
import { useSharedStyles } from "../../lib/styles";

// Legal pages live on apps/web (see startup-launch-checklist.md > Category A) —
// linked out to rather than duplicated as native screens. Same fallback
// pattern as (auth)/sign-up.tsx.
const WEB_APP_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function SettingsScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const { largeText, setLargeText } = useAccessibility();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Settings</Text>

      <View style={shared.card}>
        <Text style={shared.subtitle}>Account</Text>
        <Button label="Profile" variant="secondary" onPress={() => router.push("/profile")} />
        <Button label="Subscription & Billing" variant="secondary" onPress={() => router.push("/billing")} />
        <Button label="Cancel plan" variant="secondary" onPress={() => router.push("/cancel")} />
      </View>

      <View style={shared.card}>
        <Text style={shared.subtitle}>Support</Text>
        <Button label="Help & FAQ" variant="secondary" onPress={() => router.push("/help")} />
      </View>

      <View style={shared.card}>
        <Text style={shared.subtitle}>Legal</Text>
        <Button label="Privacy Policy" variant="secondary" onPress={() => Linking.openURL(`${WEB_APP_URL}/privacy`)} />
        <Button label="Terms of Service" variant="secondary" onPress={() => Linking.openURL(`${WEB_APP_URL}/terms`)} />
      </View>

      <View style={shared.card}>
        <View style={shared.switchRow}>
          <Text style={shared.subtitle}>Large text</Text>
          <Switch value={largeText} onValueChange={setLargeText} accessibilityLabel="Large text" />
        </View>
        <Text>Makes text throughout the app bigger and easier to read.</Text>
      </View>
    </ScrollView>
  );
}
