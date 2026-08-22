import { ClerkProvider } from "@clerk/clerk-expo";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccessibilityProvider } from "../lib/accessibility";
import { tokenCache } from "../lib/clerk-token-cache";
import { ApiProvider } from "../lib/rest/ApiProvider";
import { TRPCProvider } from "../lib/trpc";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
}

// Route groups below ((auth), (app)) each own their own auth-gating redirect
// — the client-side equivalent of apps/web's proxy.ts, since Expo has no
// server middleware to protect routes at.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
          <ApiProvider>
            <TRPCProvider>
              <Slot />
            </TRPCProvider>
          </ApiProvider>
        </ClerkProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
