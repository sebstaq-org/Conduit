import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

interface IconButtonInteractionState {
  disabled: boolean;
  hovered: boolean;
  pressed: boolean;
}

interface IconButtonInteractionStyleContext {
  appearance: IconButtonAppearance;
  buttonStyle: ViewStyle;
  state: IconButtonInteractionState;
  theme: Theme;
}

type IconButtonAppearance = "filled" | "ghost";

function setAppearanceStyle(
  theme: Theme,
  appearance: IconButtonAppearance,
  buttonStyle: ViewStyle,
): void {
  if (appearance === "filled") {
    buttonStyle.backgroundColor = theme.colors.iconButtonFilledBackground;
  }
}

function setInteractionStyle(context: IconButtonInteractionStyleContext): void {
  const { appearance, buttonStyle, state, theme } = context;

  if (state.disabled) {
    buttonStyle.opacity = 0.42;
    return;
  }

  if (state.hovered && appearance === "ghost") {
    buttonStyle.backgroundColor = theme.colors.hoverBackground;
  }

  if (state.pressed) {
    buttonStyle.opacity = 0.72;
  }
}

function createIconButtonStyle(
  theme: Theme,
  appearance: IconButtonAppearance,
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

  setAppearanceStyle(theme, appearance, buttonStyle);
  setInteractionStyle({ appearance, buttonStyle, state, theme });

  return buttonStyle;
}

export { createIconButtonStyle };
export type { IconButtonAppearance, IconButtonInteractionState };
