import { Trigger } from "@rn-primitives/popover";
import { useTheme } from "@shopify/restyle";
import { useState } from "react";
import { Pressable } from "react-native";
import type { Theme } from "@/theme";
import { ConnectionStatusIndicator } from "@/ui/connection-status-indicator";
import { createIconButtonStyle } from "@/ui/icon-button/icon-button.styles";
import type { ConnectionStatusKind } from "@/ui/connection-status-indicator";
import type { IconButtonAppearance } from "@/ui/icon-button/icon-button.styles";

interface PopoverStatusTriggerProps {
  accessibilityLabel: string;
  appearance?: IconButtonAppearance | undefined;
  disabled?: boolean | undefined;
  status: ConnectionStatusKind;
}

function PopoverStatusTrigger({
  accessibilityLabel,
  appearance = "ghost",
  disabled = false,
  status,
}: PopoverStatusTriggerProps): React.JSX.Element {
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
        <ConnectionStatusIndicator
          label={`${accessibilityLabel} status`}
          status={status}
        />
      </Pressable>
    </Trigger>
  );
}

export { PopoverStatusTrigger };
