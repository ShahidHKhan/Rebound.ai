import { Pressable, ScrollView, Text, View } from "react-native";

import { useSharedStyles } from "../lib/styles";

// React Native has no <select>/<checkbox> — this is the one toggle-button
// primitive reused everywhere an enum or multi-select field is needed
// (single-select: parent keeps `selected` to one item and replaces it on
// toggle; multi-select: parent adds/removes from the array).
export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  scrollable,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  // For long option lists (e.g. every half-hour in a day) — renders as a
  // bounded, horizontally-scrolling box instead of an unbounded wrapping
  // grid, so it doesn't push the rest of the form down the page.
  scrollable?: boolean;
}) {
  const shared = useSharedStyles();

  const chips = options.map((option) => {
    const isSelected = selected.includes(option.value);
    return (
      <Pressable
        key={option.value}
        style={[shared.chip, isSelected && shared.chipSelected]}
        onPress={() => onToggle(option.value)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={isSelected ? shared.chipTextSelected : shared.chipText}>{option.label}</Text>
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={shared.chipScrollBox}>
        <View style={shared.chipScrollRow}>{chips}</View>
      </ScrollView>
    );
  }

  return <View style={shared.row}>{chips}</View>;
}
