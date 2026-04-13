import { Pressable } from "react-native";
import { createModalOverlayStyle } from "./modal.styles";

interface ModalOverlayProps {
  onPress?: (() => void) | undefined;
}

function ModalOverlay({ onPress }: ModalOverlayProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel="Close settings"
      accessibilityRole="button"
      onPress={onPress}
      style={createModalOverlayStyle()}
    />
  );
}

export { ModalOverlay };
