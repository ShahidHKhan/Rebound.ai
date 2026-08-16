import { Pressable, Text } from "react-native";

import { useSharedStyles } from "../lib/styles";

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const shared = useSharedStyles();

  if (variant === "secondary") {
    return (
      <Pressable
        style={[shared.secondaryButton, disabled && shared.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text style={shared.secondaryButtonText}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[shared.button, disabled && shared.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={shared.buttonText}>{label}</Text>
    </Pressable>
  );
}
