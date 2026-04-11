import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

interface IconSlotMetrics {
  color: string;
  glyphSize: number;
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

export { createIconSlotFrameStyle, iconSlotMetrics };
export type { IconSlotMetrics };
