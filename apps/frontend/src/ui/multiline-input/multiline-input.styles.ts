import type { TextStyle } from "react-native";
import type { Theme } from "@/theme";

function createMultilineInputStyle(theme: Theme): TextStyle {
  return {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    minHeight: theme.panel.composerInputMinHeight,
    padding: 0,
    textAlignVertical: "top",
  };
}

export { createMultilineInputStyle };
