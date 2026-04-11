import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

type RowLabelVariant = "rowLabel" | "rowLabelMuted";

interface RowInteractionState {
  hovered: boolean;
  pressed: boolean;
}

const rowAlignItems = "center" as const;
const rowFlexDirection = "row" as const;
const rowLabelNumberOfLines = 1;

function createRowStyle(
  theme: Theme,
  depth: number,
  state: RowInteractionState,
): ViewStyle {
  const rowStyle: ViewStyle = {
    alignItems: rowAlignItems,
    borderRadius: theme.borderRadii.row,
    flexDirection: rowFlexDirection,
    gap: theme.spacing.md,
    minHeight: theme.panel.rowHeight,
    paddingLeft: depth * theme.spacing.rowIndent,
    paddingRight: theme.spacing.none,
  };

  if (state.hovered) {
    rowStyle.backgroundColor = theme.colors.hoverBackground;
  }

  if (state.pressed) {
    rowStyle.backgroundColor = theme.colors.pressedBackground;
    rowStyle.opacity = 0.72;
  }

  return rowStyle;
}

function rowLabelVariant(muted: boolean): RowLabelVariant {
  if (muted) {
    return "rowLabelMuted";
  }

  return "rowLabel";
}

export { createRowStyle, rowLabelNumberOfLines, rowLabelVariant };
export type { RowInteractionState, RowLabelVariant };
