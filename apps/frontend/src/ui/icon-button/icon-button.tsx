import { Pressable } from "react-native";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { iconButtonStyles } from "./icon-button.styles";

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
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        iconButtonStyles.button,
        pressed && iconButtonStyles.pressed,
      ]}
    >
      <IconSlot name={icon} />
    </Pressable>
  );
}

export { IconButton };
