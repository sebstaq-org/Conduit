import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const navigationPanelStyles = StyleSheet.create({
  heading: {
    color: panelTokens.colors.text,
    fontSize: 16,
    fontWeight: panelTokens.font.medium,
    lineHeight: 22,
    marginBottom: 8,
  },
});

export { navigationPanelStyles };
