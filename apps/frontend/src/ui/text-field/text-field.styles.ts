import type { TextStyle } from "react-native";
import type { Theme } from "@/theme";

function createTextFieldStyle(theme: Theme): TextStyle {
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

export { createTextFieldStyle };
