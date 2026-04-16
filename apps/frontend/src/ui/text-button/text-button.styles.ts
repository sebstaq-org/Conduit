import type { TextStyle, ViewStyle } from "react-native";
import type { Theme } from "@/theme";

type TextButtonAppearance = "option" | "primary" | "secondary";

interface TextButtonState {
  disabled: boolean;
  hovered: boolean;
  pressed: boolean;
  selected: boolean;
}

interface TextButtonStateStyleContext {
  appearance: TextButtonAppearance;
  state: TextButtonState;
  style: ViewStyle;
  theme: Theme;
}

function applyTextButtonAppearanceStyle(
  theme: Theme,
  appearance: TextButtonAppearance,
  style: ViewStyle,
): void {
  if (appearance === "option") {
    style.alignSelf = "stretch";
  }
  if (appearance === "primary") {
    style.backgroundColor = theme.colors.iconButtonFilledBackground;
    style.justifyContent = "center";
    style.minHeight = theme.panel.iconButton;
  }
}

function applyTextButtonStateStyle(context: TextButtonStateStyleContext): void {
  const { appearance, state, style, theme } = context;
  if (appearance === "option" && state.selected) {
    style.backgroundColor = theme.colors.composerControlBackground;
  }
  if (appearance === "option" && state.hovered && !state.selected) {
    style.backgroundColor = theme.colors.hoverBackground;
  }
  if (state.pressed) {
    style.opacity = 0.72;
  }
  if (state.disabled) {
    style.opacity = 0.45;
  }
}

function createTextButtonStyle(
  theme: Theme,
  appearance: TextButtonAppearance,
  state: TextButtonState,
): ViewStyle {
  const style: ViewStyle = {
    alignItems: "center",
    borderRadius: theme.borderRadii.row,
    flexDirection: "row",
    justifyContent: "flex-start",
    minHeight: theme.panel.rowHeight,
    opacity: 1,
    paddingHorizontal: theme.spacing.sm,
  };

  applyTextButtonAppearanceStyle(theme, appearance, style);
  applyTextButtonStateStyle({ appearance, state, style, theme });

  return style;
}

function createTextButtonTextStyle(
  theme: Theme,
  appearance: TextButtonAppearance,
): TextStyle {
  let color = theme.colors.textPrimary;
  if (appearance === "primary") {
    color = theme.colors.iconButtonFilledIcon;
  }
  if (appearance === "secondary") {
    color = theme.colors.textMuted;
  }
  return {
    color,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  };
}

export { createTextButtonStyle, createTextButtonTextStyle };
export type { TextButtonAppearance, TextButtonState };
