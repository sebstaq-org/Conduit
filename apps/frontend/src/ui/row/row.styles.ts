import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

type RowLabelVariant = "rowLabel" | "rowLabelMuted";

const rowAlignItems = "center" as const;
const rowBorderRadius = "row" as const;
const rowFlexDirection = "row" as const;
const rowGap = "md" as const;
const rowLabelNumberOfLines = 1;
const rowPaddingHorizontal = "none" as const;

function createRowIndentStyle(theme: Theme, depth: number): ViewStyle {
  return { paddingLeft: depth * theme.spacing.rowIndent };
}

function rowLabelVariant(muted: boolean): RowLabelVariant {
  if (muted) {
    return "rowLabelMuted";
  }

  return "rowLabel";
}

function rowMinHeight(theme: Theme): number {
  return theme.panel.rowHeight;
}

export {
  createRowIndentStyle,
  rowAlignItems,
  rowBorderRadius,
  rowFlexDirection,
  rowGap,
  rowLabelNumberOfLines,
  rowLabelVariant,
  rowMinHeight,
  rowPaddingHorizontal,
};
export type { RowLabelVariant };
