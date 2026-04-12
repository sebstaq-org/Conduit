import { Platform } from "react-native";
import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

interface MenuItemInteractionState {
  disabled: boolean;
  pressed: boolean;
}

const menuContentAlign = "end" as const;
const menuContentSide = "bottom" as const;
const menuContentSideOffset = 6;

function createMenuContentStyle(theme: Theme): ViewStyle {
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

function createMenuItemStyle(
  theme: Theme,
  state: MenuItemInteractionState,
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

function menuItemLabelVariant(disabled: boolean): "rowLabel" | "rowLabelMuted" {
  if (disabled) {
    return "rowLabelMuted";
  }

  return "rowLabel";
}

export {
  createMenuContentStyle,
  createMenuItemStyle,
  menuContentAlign,
  menuContentSide,
  menuContentSideOffset,
  menuItemLabelVariant,
};
