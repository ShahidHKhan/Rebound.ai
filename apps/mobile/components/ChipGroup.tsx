import { Pressable, Text, View } from "react-native";

import { shared } from "../lib/styles";

// React Native has no <select>/<checkbox> — this is the one toggle-button
// primitive reused everywhere an enum or multi-select field is needed
// (single-select: parent keeps `selected` to one item and replaces it on
// toggle; multi-select: parent adds/removes from the array).
export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={shared.row}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            style={[shared.chip, isSelected && shared.chipSelected]}
            onPress={() => onToggle(option.value)}
          >
            <Text style={isSelected ? shared.chipTextSelected : shared.chipText}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
