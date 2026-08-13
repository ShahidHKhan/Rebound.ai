import { ClerkProvider } from "@clerk/clerk-expo";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { tokenCache } from "./lib/clerk-token-cache";
import { TRPCProvider, trpc } from "./lib/trpc";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
}

function HealthCheck() {
  const health = trpc.health.ping.useQuery();

  return (
    <Text>
      tRPC health check:{" "}
      {health.isLoading
        ? "checking..."
        : health.error
          ? `error: ${health.error.message}`
          : `ok (${health.data?.timestamp})`}
    </Text>
  );
}

export default function App() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
      <TRPCProvider>
        <View style={styles.container}>
          <Text style={styles.title}>Rebound.ai</Text>
          <HealthCheck />
          <StatusBar style="auto" />
        </View>
      </TRPCProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
});
