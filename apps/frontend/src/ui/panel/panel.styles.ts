import { StyleSheet } from "react-native";
import { panelTokens } from "@/ui/tokens";

const panelStyles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: panelTokens.space.contentX,
  },
  host: {
    backgroundColor: panelTokens.colors.background,
    flex: 1,
    flexDirection: "row",
  },
  panel: {
    backgroundColor: panelTokens.colors.background,
    borderColor: panelTokens.colors.border,
    borderRightWidth: 1,
    flexShrink: 0,
    maxWidth: panelTokens.sizes.desktopPanelWidth,
    width: "100%",
  },
  remainder: {
    backgroundColor: panelTokens.colors.background,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    height: 54,
    paddingHorizontal: panelTokens.space.contentX,
    paddingTop: 18,
  },
});

export { panelStyles };
