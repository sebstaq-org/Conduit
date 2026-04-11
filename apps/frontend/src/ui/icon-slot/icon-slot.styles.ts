import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const iconSlotStyles = StyleSheet.create({
  icon: {
    alignItems: "center",
    height: panelTokens.sizes.icon,
    justifyContent: "center",
    width: panelTokens.sizes.icon,
  },
  mark: {
    color: panelTokens.colors.icon,
    fontSize: 16,
    fontWeight: panelTokens.font.medium,
    lineHeight: 18,
  },
});

export { iconSlotStyles };
