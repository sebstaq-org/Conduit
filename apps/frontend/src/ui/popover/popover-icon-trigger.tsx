import { Trigger } from "@rn-primitives/popover";
import { useTheme } from "@shopify/restyle";
import { useState } from "react";
import { Pressable } from "react-native";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { createIconButtonStyle } from "@/ui/icon-button/icon-button.styles";
import type { IconButtonAppearance } from "@/ui/icon-button/icon-button.styles";

interface PopoverIconTriggerProps {
  accessibilityLabel: string;
  appearance?: IconButtonAppearance | undefined;
  disabled?: boolean | undefined;
  icon: IconSlotName;
}

function iconColorForAppearance(
  appearance: IconButtonAppearance,
): "iconButtonFilledIcon" | undefined {
  if (appearance === "filled") {
    return "iconButtonFilledIcon";
  }

  return undefined;
}

function PopoverIconTrigger({
  accessibilityLabel,
  appearance = "ghost",
  disabled = false,
  icon,
}: PopoverIconTriggerProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [hovered, setHovered] = useState(false);

  return (
    <Trigger asChild disabled={disabled}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onHoverIn={() => {
          if (!disabled) {
            setHovered(true);
          }
        }}
        onHoverOut={() => {
          setHovered(false);
        }}
        style={({ pressed }) =>
          createIconButtonStyle(theme, appearance, {
            disabled,
            hovered,
            pressed,
          })
        }
      >
        <IconSlot color={iconColorForAppearance(appearance)} name={icon} />
      </Pressable>
    </Trigger>
  );
}

export { PopoverIconTrigger };
