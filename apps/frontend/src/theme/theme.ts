import { createTheme } from "@shopify/restyle";

const baseTheme = {
  borderRadii: {
    none: 0,
    panel: 8,
    row: 6,
  },
  breakpoints: {
    phone: 0,
    web: 768,
  },
  panel: {
    composerInputMinHeight: 40,
    composerSurfaceMinHeight: 98,
    icon: 18,
    iconButton: 28,
    iconGlyph: 16,
    maxWidth: 414,
    rowHeight: 34,
    topBarHeight: 54,
  },
  spacing: {
    none: 0,
    xxs: 2,
    xs: 8,
    sm: 10,
    md: 12,
    lg: 14,
    topBarGap: 18,
    contentX: 22,
    contentTop: 22,
    footerTop: 10,
    footerBottom: 22,
    rowIndent: 26,
    scrollBottom: 24,
    sectionTop: 18,
  },
  textVariants: {
    defaults: {
      color: "textPrimary",
      fontWeight: "400",
    },
    meta: {
      color: "textMuted",
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 18,
    },
    panelHeading: {
      color: "textPrimary",
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 22,
    },
    rowLabel: {
      color: "textPrimary",
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 18,
    },
    rowLabelMuted: {
      color: "textMuted",
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 18,
    },
    sectionTitle: {
      color: "textMuted",
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 18,
    },
  },
} as const;

const lightTheme = createTheme({
  borderRadii: baseTheme.borderRadii,
  breakpoints: baseTheme.breakpoints,
  colors: {
    background: "#ffffff",
    borderSubtle: "#ececec",
    composerControlBackground: "#eeeeee",
    composerSurface: "#f6f6f6",
    errorToastBackground: "#b42318",
    errorToastBorder: "#912018",
    errorToastText: "#ffffff",
    hoverBackground: "#f6f6f6",
    selectedBackground: "#f6f6f6",
    iconButtonFilledBackground: "#d8d8d8",
    iconButtonFilledIcon: "#3d3d3d",
    iconMuted: "#8d8d8d",
    pressedBackground: "#f1f1f1",
    sessionAgentText: "#2f2f2f",
    sessionUserBubble: "#090909",
    sessionUserBubbleText: "#ffffff",
    textMuted: "#b7b7b7",
    textPrimary: "#5b5b5b",
  },
  panel: baseTheme.panel,
  spacing: baseTheme.spacing,
  textVariants: baseTheme.textVariants,
});

const darkTheme = createTheme({
  borderRadii: baseTheme.borderRadii,
  breakpoints: baseTheme.breakpoints,
  colors: {
    background: "#101214",
    borderSubtle: "#24282c",
    composerControlBackground: "#36383a",
    composerSurface: "#2a2c2e",
    errorToastBackground: "#b42318",
    errorToastBorder: "#fda29b",
    errorToastText: "#ffffff",
    hoverBackground: "#181b1f",
    selectedBackground: "#181b1f",
    iconButtonFilledBackground: "#a7a7a7",
    iconButtonFilledIcon: "#101214",
    iconMuted: "#9a9fa5",
    pressedBackground: "#1d2126",
    sessionAgentText: "#d6d8db",
    sessionUserBubble: "#000000",
    sessionUserBubbleText: "#ffffff",
    textMuted: "#858b92",
    textPrimary: "#d6d8db",
  },
  panel: baseTheme.panel,
  spacing: baseTheme.spacing,
  textVariants: baseTheme.textVariants,
});

type Theme = typeof lightTheme;
type ThemeMode = "dark" | "light";

export { darkTheme, lightTheme };
export type { Theme, ThemeMode };
