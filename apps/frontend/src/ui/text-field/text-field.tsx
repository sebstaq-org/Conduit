import { useTheme } from "@shopify/restyle";
import { TextInput } from "react-native";
import type { Theme } from "@/theme";
import { createTextFieldStyle } from "./text-field.styles";
import type { TextFieldAppearance } from "./text-field.styles";

interface TextFieldProps {
  accessibilityLabel: string;
  appearance?: TextFieldAppearance | undefined;
  disabled?: boolean | undefined;
  onChangeText: (value: string) => void;
  onSubmit?: (() => void) | undefined;
  placeholder: string;
  value: string;
}

function nativeInputId(accessibilityLabel: string): string {
  return accessibilityLabel.toLowerCase().replaceAll(/\s+/g, "-");
}

function TextField({
  accessibilityLabel,
  appearance = "default",
  disabled = false,
  onChangeText,
  onSubmit,
  placeholder,
  value,
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      editable={!disabled}
      nativeID={nativeInputId(accessibilityLabel)}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.textPrimary}
      style={createTextFieldStyle(theme, appearance)}
      value={value}
    />
  );
}

export { TextField };
