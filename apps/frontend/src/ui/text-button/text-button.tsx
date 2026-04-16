import { useState } from "react";
import { Pressable } from "react-native";
import { useTheme } from "@shopify/restyle";
import { Text } from "@/theme";
import type { Theme } from "@/theme";
import {
  createTextButtonStyle,
  createTextButtonTextStyle,
} from "./text-button.styles";
import type { TextButtonAppearance } from "./text-button.styles";

interface TextButtonProps {
  appearance?: TextButtonAppearance | undefined;
  disabled?: boolean | undefined;
  label: string;
  onPress?: (() => void) | undefined;
  selected?: boolean | undefined;
}

function TextButton({
  appearance = "option",
  disabled = false,
  label,
  onPress,
  selected = false,
}: TextButtonProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [hovered, setHovered] = useState(false);
  const isDisabled = disabled || onPress === undefined;
  const textStyle = createTextButtonTextStyle(theme, appearance);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected }}
      disabled={isDisabled}
      onHoverIn={() => {
        setHovered(true);
      }}
      onHoverOut={() => {
        setHovered(false);
      }}
      onPress={onPress}
      style={({ pressed }) =>
        createTextButtonStyle(theme, appearance, {
          disabled: isDisabled,
          hovered,
          pressed,
          selected,
        })
      }
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export { TextButton };
