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

interface PanelContainerStyleOptions {
  width?: number | undefined;
}

function createPanelContainerStyle(
  theme: Theme,
  options: PanelContainerStyleOptions = {},
): ViewStyle {
  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderSubtle,
    borderRightWidth: 1,
    flexShrink: 0,
  };

  if (options.width !== undefined) {
    return Object.assign(baseStyle, {
      flexGrow: 0,
      width: options.width,
    } satisfies ViewStyle);
  }

  return Object.assign(baseStyle, {
    flex: 1,
    maxWidth: theme.panel.defaultWidth,
    width: "100%",
  } satisfies ViewStyle);
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
