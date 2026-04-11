import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

interface IconButtonInteractionState {
  hovered: boolean;
  pressed: boolean;
}

function createIconButtonStyle(
  theme: Theme,
  state: IconButtonInteractionState,
): ViewStyle {
  const buttonStyle: ViewStyle = {
    alignItems: "center",
    borderRadius: theme.borderRadii.row,
    height: theme.panel.iconButton,
    justifyContent: "center",
    opacity: 1,
    width: theme.panel.iconButton,
  };

  if (state.hovered) {
    buttonStyle.backgroundColor = theme.colors.hoverBackground;
  }

  if (state.pressed) {
    buttonStyle.backgroundColor = theme.colors.pressedBackground;
    buttonStyle.opacity = 0.72;
  }

  return buttonStyle;
}

export { createIconButtonStyle };
export type { IconButtonInteractionState };
