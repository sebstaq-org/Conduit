import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const sectionStyles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 14,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: panelTokens.space.sectionY,
  },
  title: {
    color: panelTokens.colors.mutedText,
    fontSize: 14,
    fontWeight: panelTokens.font.medium,
    lineHeight: 18,
  },
});

export { sectionStyles };
