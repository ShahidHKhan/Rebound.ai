import { ActivityIndicator, Pressable, Text } from "react-native";

import { useSharedStyles } from "../lib/styles";

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  const shared = useSharedStyles();
  const isDisabled = disabled || loading;

  if (variant === "secondary") {
    return (
      <Pressable
        style={[shared.secondaryButton, isDisabled && shared.buttonDisabled]}
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      >
        {loading ? <ActivityIndicator color="#2563eb" /> : <Text style={shared.secondaryButtonText}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[shared.button, isDisabled && shared.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={shared.buttonText}>{label}</Text>}
    </Pressable>
  );
}
