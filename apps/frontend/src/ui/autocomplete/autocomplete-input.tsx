import { useTheme } from "@shopify/restyle";
import { TextInput } from "react-native";
import type { TextInputKeyPressEvent } from "react-native";
import type { Theme } from "@/theme";
import {
  autocompleteInputAccessibilityRole,
  createAutocompleteInputFrameStyle,
  createAutocompleteInputStyle,
} from "./autocomplete.styles";

interface AutocompleteInputProps {
  accessibilityLabel: string;
  disabled: boolean;
  nativeID: string;
  onChangeText: (query: string) => void;
  onKeyPress: (event: TextInputKeyPressEvent) => void;
  onSubmit: () => void;
  placeholder: string;
  query: string;
}

function AutocompleteInput({
  accessibilityLabel,
  disabled,
  nativeID,
  onChangeText,
  onKeyPress,
  onSubmit,
  placeholder,
  query,
}: AutocompleteInputProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={autocompleteInputAccessibilityRole}
      autoCapitalize="none"
      autoCorrect={false}
      editable={!disabled}
      nativeID={nativeID}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.textPrimary}
      style={[
        createAutocompleteInputFrameStyle(theme),
        createAutocompleteInputStyle(theme),
      ]}
      value={query}
    />
  );
}

export { AutocompleteInput };
