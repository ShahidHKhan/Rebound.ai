import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

// Routes where a swipe-left-for-home shouldn't fire: "/" is already home
// (no-op), and "/onboarding" holds free-text health/injury answers in
// local-only state that a swipe would silently discard — too easy to lose
// mid-form by accident.
const SWIPE_HOME_EXCLUDED_ROUTES = new Set(["/", "/onboarding"]);

// Horizontal distance (px) a swipe must cover before it counts, so an
// accidental brush doesn't fire it.
const SWIPE_HOME_THRESHOLD = 80;

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const swipeHomeEnabled = !SWIPE_HOME_EXCLUDED_ROUTES.has(pathname);

  // Replaces expo-router's default per-screen edge-swipe-to-go-back (Stack's
  // gestureEnabled below is turned off) with one consistent gesture across
  // every screen: swipe left, from anywhere, straight to Today — not just
  // one level back. activeOffsetX/failOffsetY let vertical ScrollViews keep
  // handling vertical drags normally; only a clearly horizontal, clearly
  // leftward drag activates this.
  const swipeHomeGesture = Gesture.Pan()
    .enabled(swipeHomeEnabled)
    .activeOffsetX(-40)
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      if (event.translationX < -SWIPE_HOME_THRESHOLD) {
        router.replace("/");
      }
    });

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <GestureDetector gesture={swipeHomeGesture}>
      <SafeAreaView style={{ flex: 1 }}>
        {swipeHomeEnabled && (
          <Text style={styles.hint}>← swipe left for home</Text>
        )}
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </SafeAreaView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hint: {
    textAlign: "center",
    fontSize: 11,
    color: "#9ca3af",
    paddingVertical: 4,
  },
});
