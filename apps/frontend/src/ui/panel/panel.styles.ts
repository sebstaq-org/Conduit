import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

const panelBodyFlex = 1;
const panelBodyPaddingTop = "contentTop" as const;
const panelBodyPaddingX = "contentX" as const;
const panelFooterPaddingBottom = "footerBottom" as const;
const panelFooterPaddingTop = "footerTop" as const;
const panelHostBackgroundColor = "background" as const;
const panelHostFlex = 1;
const panelHostFlexDirection = "row" as const;
const panelTopBarAlignItems = "center" as const;
const panelTopBarFlexDirection = "row" as const;
const panelTopBarGap = "topBarGap" as const;
const panelTopBarPaddingTop = "topBarGap" as const;
const panelTopBarPaddingX = "contentX" as const;

function createPanelContainerStyle(theme: Theme): ViewStyle {
  return {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderSubtle,
    borderRightWidth: 1,
    flexShrink: 0,
    maxWidth: theme.panel.maxWidth,
    width: "100%",
  };
}

function panelTopBarHeight(theme: Theme): number {
  return theme.panel.topBarHeight;
}

export {
  createPanelContainerStyle,
  panelBodyFlex,
  panelBodyPaddingTop,
  panelBodyPaddingX,
  panelFooterPaddingBottom,
  panelFooterPaddingTop,
  panelHostBackgroundColor,
  panelHostFlex,
  panelHostFlexDirection,
  panelTopBarAlignItems,
  panelTopBarFlexDirection,
  panelTopBarGap,
  panelTopBarHeight,
  panelTopBarPaddingTop,
  panelTopBarPaddingX,
};
