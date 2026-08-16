import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useAccessibility } from "./accessibility";

// Factory rather than a static StyleSheet.create so font sizes can scale
// with the in-app "large text" preference (see lib/accessibility.tsx).
// Non-font values (borders, colors, layout) are scale-independent.
function createShared(fontScale: number) {
  return StyleSheet.create({
    page: { flexGrow: 1, padding: 24, gap: 12 },
    centeredPage: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
    title: { fontSize: 28 * fontScale, fontWeight: "700", marginBottom: 4 },
    subtitle: { fontSize: 20 * fontScale, fontWeight: "600" },
    label: { fontSize: 14 * fontScale, fontWeight: "600", color: "#374151" },
    input: {
      borderWidth: 1,
      borderColor: "#ccc",
      borderRadius: 8,
      padding: 12,
      fontSize: 16 * fontScale,
      minHeight: 44,
    },
    button: {
      backgroundColor: "#2563eb",
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      minHeight: 44,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 * fontScale },
    secondaryButton: {
      borderWidth: 1,
      borderColor: "#2563eb",
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    secondaryButtonText: { color: "#2563eb", fontWeight: "600", fontSize: 16 * fontScale },
    error: { color: "#dc2626", fontSize: 14 * fontScale },
    alert: { color: "#dc2626", fontWeight: "600", fontSize: 14 * fontScale },
    link: { color: "#2563eb", marginTop: 16, textAlign: "center", fontSize: 16 * fontScale },
    card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 16, marginBottom: 12, gap: 8 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
    chip: {
      borderWidth: 1,
      borderColor: "#ccc",
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 44,
      justifyContent: "center",
    },
    chipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
    chipText: { color: "#111", fontSize: 14 * fontScale },
    chipTextSelected: { color: "#fff", fontSize: 14 * fontScale },
    chipScrollBox: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, maxHeight: 64 },
    chipScrollRow: { flexDirection: "row", gap: 8, padding: 8, alignItems: "center" },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  });
}

// Unscaled default — kept for any call site that genuinely can't use the
// hook (none currently), so nothing breaks if imported outside a component.
export const shared = createShared(1);

export function useSharedStyles() {
  const { fontScale } = useAccessibility();
  return useMemo(() => createShared(fontScale), [fontScale]);
}
