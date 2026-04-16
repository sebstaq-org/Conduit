import type { TextStyle } from "react-native";
import type { Theme } from "@/theme";

type TextFieldAppearance = "default" | "plain";

function createDefaultTextFieldStyle(theme: Theme): TextStyle {
  return {
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.borderRadii.row,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    minHeight: theme.panel.rowHeight,
    paddingBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  };
}

function createPlainTextFieldStyle(theme: Theme): TextStyle {
  return {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    minHeight: theme.panel.rowHeight,
    paddingBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.none,
    paddingRight: theme.spacing.none,
    paddingTop: theme.spacing.xs,
  };
}

function createTextFieldStyle(
  theme: Theme,
  appearance: TextFieldAppearance,
): TextStyle {
  if (appearance === "plain") {
    return createPlainTextFieldStyle(theme);
  }
  return createDefaultTextFieldStyle(theme);
}

export { createTextFieldStyle };
export type { TextFieldAppearance };
