import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { Pressable } from "react-native";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { createIconButtonStyle } from "./icon-button.styles";
import type { IconButtonAppearance } from "./icon-button.styles";

interface IconButtonProps {
  accessibilityLabel: string;
  appearance?: IconButtonAppearance | undefined;
  disabled?: boolean | undefined;
  icon: IconSlotName;
  onPress: () => void;
}

function iconColorForAppearance(
  appearance: IconButtonAppearance,
): "iconButtonFilledIcon" | undefined {
  if (appearance === "filled") {
    return "iconButtonFilledIcon";
  }

  return undefined;
}

function IconButton({
  accessibilityLabel,
  appearance = "ghost",
  disabled = false,
  icon,
  onPress,
}: IconButtonProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onHoverIn={() => {
        if (disabled) {
          return;
        }
        setHovered(true);
      }}
      onHoverOut={() => {
        setHovered(false);
      }}
      onPress={onPress}
      style={({ pressed }) =>
        createIconButtonStyle(theme, appearance, { disabled, hovered, pressed })
      }
    >
      <IconSlot color={iconColorForAppearance(appearance)} name={icon} />
    </Pressable>
  );
}

export { IconButton };
