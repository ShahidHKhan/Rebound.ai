import { useRouter } from "expo-router";
import { ScrollView, Switch, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { useAccessibility } from "../../lib/accessibility";
import { useSharedStyles } from "../../lib/styles";

export default function SettingsScreen() {
  const router = useRouter();
  const shared = useSharedStyles();
  const { largeText, setLargeText } = useAccessibility();

  return (
    <ScrollView contentContainerStyle={shared.page}>
      <Button label="← Back" variant="secondary" onPress={() => router.back()} />
      <Text style={shared.title}>Settings</Text>

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
