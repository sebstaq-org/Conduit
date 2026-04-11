import { useTheme } from "@shopify/restyle";
import { Pressable } from "react-native";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { createIconButtonStyle } from "./icon-button.styles";

interface IconButtonProps {
  accessibilityLabel: string;
  icon: IconSlotName;
  onPress: () => void;
}

function IconButton({
  accessibilityLabel,
  icon,
  onPress,
}: IconButtonProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => createIconButtonStyle(theme, pressed)}
    >
      <IconSlot name={icon} />
    </Pressable>
  );
}

export { IconButton };
