import { useTheme } from "@shopify/restyle";
import { TextInput } from "react-native";
import type { TextInputKeyPressEvent } from "react-native";
import type { Theme } from "@/theme";
import { handleMultilineInputKeyPress } from "./multiline-input-keypress";
import { createMultilineInputStyle } from "./multiline-input.styles";

interface MultilineInputProps {
  accessibilityLabel: string;
  disabled?: boolean | undefined;
  onChangeText: (value: string) => void;
  onEnterWithoutShift?: (() => void) | undefined;
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
  onEnterWithoutShift,
  placeholder,
  value,
}: MultilineInputProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  function handleKeyPress(event: TextInputKeyPressEvent): void {
    if (onEnterWithoutShift === undefined) {
      return;
    }

    handleMultilineInputKeyPress({ event, onEnterWithoutShift });
  }

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      autoCapitalize="none"
      autoCorrect={false}
      editable={!disabled}
      multiline
      nativeID={nativeInputId(accessibilityLabel)}
      onChangeText={onChangeText}
      onKeyPress={handleKeyPress}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.textPrimary}
      spellCheck={false}
      style={createMultilineInputStyle(theme)}
      value={value}
    />
  );
}

export { MultilineInput };
