import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

interface IconSlotMetrics {
  color: string;
  glyphSize: number;
}

interface NavigationPanelToggleIconStyles {
  bottomLine: ViewStyle;
  frame: ViewStyle;
  topLine: ViewStyle;
}

function iconSlotMetrics(theme: Theme): IconSlotMetrics {
  return {
    color: theme.colors.iconMuted,
    glyphSize: theme.panel.iconGlyph,
  };
}

function createIconSlotFrameStyle(theme: Theme): ViewStyle {
  return {
    alignItems: "center",
    height: theme.panel.icon,
    justifyContent: "center",
    width: theme.panel.icon,
  };
}

function createNavigationPanelToggleIconStyles(
  theme: Theme,
  color: string,
): NavigationPanelToggleIconStyles {
  return {
    bottomLine: {
      backgroundColor: color,
      borderRadius: theme.borderRadii.row,
      height: 2,
      width: 11,
    },
    frame: {
      alignItems: "flex-start",
      gap: 5,
      height: theme.panel.icon,
      justifyContent: "center",
      width: theme.panel.icon,
    },
    topLine: {
      backgroundColor: color,
      borderRadius: theme.borderRadii.row,
      height: 2,
      width: 16,
    },
  };
}

export {
  createIconSlotFrameStyle,
  createNavigationPanelToggleIconStyles,
  iconSlotMetrics,
};
export type { IconSlotMetrics, NavigationPanelToggleIconStyles };
