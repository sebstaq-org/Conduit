import { Platform } from "react-native";
import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

interface DropdownMenuItemInteractionState {
  disabled: boolean;
  pressed: boolean;
}

const dropdownMenuContentAlign = "end" as const;
const dropdownMenuContentSide = "bottom" as const;
const dropdownMenuContentSideOffset = 6;

function createDropdownMenuContentStyle(theme: Theme): ViewStyle {
  const contentStyle: ViewStyle = {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.borderRadii.panel,
    borderWidth: 1,
    gap: theme.spacing.xxs,
    minWidth: 190,
    padding: theme.spacing.xs,
  };

  if (Platform.OS === "web") {
    return Object.assign(contentStyle, {
      boxShadow: "0 8px 18px rgba(0, 0, 0, 0.12)",
    } satisfies ViewStyle);
  }

  return Object.assign(contentStyle, {
    elevation: 8,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  } satisfies ViewStyle);
}

function createDropdownMenuItemStyle(
  theme: Theme,
  state: DropdownMenuItemInteractionState,
): ViewStyle {
  const itemStyle: ViewStyle = {
    borderRadius: theme.borderRadii.row,
    minHeight: theme.panel.rowHeight,
    opacity: 1,
    paddingBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  };

  if (state.disabled) {
    itemStyle.opacity = 0.48;
  }

  if (state.pressed && !state.disabled) {
    itemStyle.backgroundColor = theme.colors.pressedBackground;
  }

  return itemStyle;
}

function dropdownMenuItemLabelVariant(
  disabled: boolean,
): "rowLabel" | "rowLabelMuted" {
  if (disabled) {
    return "rowLabelMuted";
  }

  return "rowLabel";
}

export {
  createDropdownMenuContentStyle,
  createDropdownMenuItemStyle,
  dropdownMenuContentAlign,
  dropdownMenuContentSide,
  dropdownMenuContentSideOffset,
  dropdownMenuItemLabelVariant,
};
