import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "rebound.largeText";

// Elderly users are an explicit target audience (see PRD) — this is an
// in-app override on top of whatever OS-level "larger text" setting the
// device already has, since RN's Text already respects that by default.
export const LARGE_TEXT_SCALE = 1.3;

type AccessibilityContextValue = {
  largeText: boolean;
  setLargeText: (value: boolean) => void;
  fontScale: number;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [largeText, setLargeTextState] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((value) => {
      if (value === "true") setLargeTextState(true);
    });
  }, []);

  const setLargeText = (value: boolean) => {
    setLargeTextState(value);
    SecureStore.setItemAsync(STORAGE_KEY, String(value)).catch(() => {});
  };

  return (
    <AccessibilityContext.Provider
      value={{ largeText, setLargeText, fontScale: largeText ? LARGE_TEXT_SCALE : 1 }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
