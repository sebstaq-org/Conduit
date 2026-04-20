import type { TextStyle } from "react-native";
import type { Theme } from "@/theme";
import { webTextInputFocusReset } from "@/ui/text-input";

function createMultilineInputStyle(theme: Theme): TextStyle {
  const inputStyle: TextStyle = {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    minHeight: theme.panel.composerInputMinHeight,
    padding: 0,
    textAlignVertical: "top",
  };

  return Object.assign(inputStyle, webTextInputFocusReset);
}

export { createMultilineInputStyle };
