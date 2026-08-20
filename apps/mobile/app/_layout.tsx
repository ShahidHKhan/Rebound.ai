// Must be the very first import in the app — react-native-gesture-handler
// patches global behavior that expo-router's own navigation internals rely
// on at import time. Anywhere later than this (including just above the
// GestureHandlerRootView usage below) is too late and throws cryptic
// runtime errors ("undefined is not a function") that don't obviously point
// back to this. This is Expo Router's own documented pattern for it, not a
// plain React Navigation index.js shim.
import "react-native-gesture-handler";

import { ClerkProvider } from "@clerk/clerk-expo";
import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccessibilityProvider } from "../lib/accessibility";
import { tokenCache } from "../lib/clerk-token-cache";
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
    // Required once at the true root by react-native-gesture-handler (used
    // by (app)/_layout.tsx's global swipe-left-for-home gesture) — must wrap
    // everything, per the library's own setup docs.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AccessibilityProvider>
          <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
            <TRPCProvider>
              <Slot />
            </TRPCProvider>
          </ClerkProvider>
        </AccessibilityProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
