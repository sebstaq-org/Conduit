import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

function createIconButtonStyle(theme: Theme, pressed: boolean): ViewStyle {
  const buttonStyle: ViewStyle = {
    alignItems: "center",
    borderRadius: theme.borderRadii.row,
    height: theme.panel.iconButton,
    justifyContent: "center",
    opacity: 1,
    width: theme.panel.iconButton,
  };

  if (pressed) {
    buttonStyle.backgroundColor = theme.colors.pressedBackground;
    buttonStyle.opacity = 0.72;
  }

  return buttonStyle;
}

export { createIconButtonStyle };
