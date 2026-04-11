import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const rowStyles = StyleSheet.create({
  label: {
    color: panelTokens.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: panelTokens.font.medium,
    lineHeight: 18,
  },
  mutedLabel: {
    color: panelTokens.colors.mutedText,
  },
  row: {
    alignItems: "center",
    borderRadius: panelTokens.radii.row,
    flexDirection: "row",
    gap: panelTokens.space.gap,
    minHeight: panelTokens.sizes.rowHeight,
    paddingHorizontal: 0,
  },
});

export { rowStyles };
