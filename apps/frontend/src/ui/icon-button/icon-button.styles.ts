import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const iconButtonStyles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: panelTokens.radii.row,
    height: panelTokens.sizes.iconButton,
    justifyContent: "center",
    width: panelTokens.sizes.iconButton,
  },
  pressed: {
    backgroundColor: panelTokens.colors.pressed,
    opacity: 0.72,
  },
});

export { iconButtonStyles };
