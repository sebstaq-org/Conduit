interface HistoryContentContainerStyle {
  alignSelf: "center";
  maxWidth: number;
  paddingBottom: number;
  width: "100%";
}

interface SessionHistoryLayoutTheme {
  panel: {
    composerSurfaceMinHeight: number;
  };
  spacing: {
    contentTop: number;
    scrollBottom: number;
  };
}

function sessionHistoryBottomPaddingForDockHeight(
  theme: SessionHistoryLayoutTheme,
  composerDockHeight: number,
): number {
  if (composerDockHeight > 0) {
    return theme.spacing.scrollBottom + composerDockHeight;
  }
  return (
    theme.spacing.scrollBottom +
    theme.panel.composerSurfaceMinHeight +
    theme.spacing.contentTop
  );
}

function sessionHistoryBottomPadding(theme: SessionHistoryLayoutTheme): number {
  return sessionHistoryBottomPaddingForDockHeight(theme, 0);
}

function createHistoryContentContainerStyle(args: {
  composerDockHeight: number;
  maxWidth: number;
  theme: SessionHistoryLayoutTheme;
}): HistoryContentContainerStyle {
  return {
    alignSelf: "center",
    maxWidth: args.maxWidth,
    paddingBottom: sessionHistoryBottomPaddingForDockHeight(
      args.theme,
      args.composerDockHeight,
    ),
    width: "100%",
  };
}

export {
  createHistoryContentContainerStyle,
  sessionHistoryBottomPadding,
  sessionHistoryBottomPaddingForDockHeight,
};
export type { HistoryContentContainerStyle, SessionHistoryLayoutTheme };
