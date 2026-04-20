import type { TextStyle, ViewStyle } from "react-native";
import type { Theme } from "@/theme";
import { webTextInputFocusReset } from "@/ui/text-input";

const autocompleteDefaultLimit = 8;
const autocompleteInputAccessibilityRole = "search" as const;
const autocompleteStatusTextVariant = "meta" as const;

function createAutocompleteInputStyle(theme: Theme): TextStyle {
  const inputStyle: TextStyle = {
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

  return Object.assign(inputStyle, webTextInputFocusReset);
}

function createAutocompleteInputFrameStyle(theme: Theme): TextStyle {
  return {
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.borderRadii.row,
    borderWidth: 1,
  };
}

function createAutocompleteRootStyle(theme: Theme): ViewStyle {
  return {
    gap: theme.spacing.xs,
    width: "100%",
  };
}

function createAutocompleteDropdownContentStyle(theme: Theme): ViewStyle {
  return {
    gap: theme.spacing.xxs,
    paddingBottom: theme.spacing.xxs,
    paddingTop: theme.spacing.xxs,
  };
}

function createAutocompleteDropdownFrameStyle(theme: Theme): ViewStyle {
  return {
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.borderRadii.row,
    borderWidth: 1,
    maxHeight: 280,
  };
}

function createAutocompleteItemStyle(
  theme: Theme,
  highlighted: boolean,
  pressed: boolean,
): ViewStyle {
  const itemStyle: ViewStyle = {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadii.row,
    minHeight: theme.panel.rowHeight,
    opacity: 1,
    paddingBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  };

  if (highlighted) {
    itemStyle.backgroundColor = theme.colors.hoverBackground;
  }

  if (pressed) {
    itemStyle.opacity = 0.72;
  }

  return itemStyle;
}

export {
  autocompleteDefaultLimit,
  autocompleteInputAccessibilityRole,
  autocompleteStatusTextVariant,
  createAutocompleteDropdownContentStyle,
  createAutocompleteDropdownFrameStyle,
  createAutocompleteInputFrameStyle,
  createAutocompleteInputStyle,
  createAutocompleteItemStyle,
  createAutocompleteRootStyle,
};
