import { useTheme } from "@shopify/restyle";
import { TextInput } from "react-native";
import type { Theme } from "@/theme";
import { createMultilineInputStyle } from "./multiline-input.styles";

interface MultilineInputProps {
  accessibilityLabel: string;
  disabled?: boolean | undefined;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}

function nativeInputId(accessibilityLabel: string): string {
  return accessibilityLabel.toLowerCase().replaceAll(/\s+/g, "-");
}

function MultilineInput({
  accessibilityLabel,
  disabled = false,
  onChangeText,
  placeholder,
  value,
}: MultilineInputProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      editable={!disabled}
      multiline
      nativeID={nativeInputId(accessibilityLabel)}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.textPrimary}
      style={createMultilineInputStyle(theme)}
      value={value}
    />
  );
}

export { MultilineInput };
