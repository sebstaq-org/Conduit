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

function sessionHistoryBottomPadding(theme: SessionHistoryLayoutTheme): number {
  return (
    theme.spacing.scrollBottom +
    theme.panel.composerSurfaceMinHeight +
    theme.spacing.contentTop
  );
}

function createHistoryContentContainerStyle(args: {
  maxWidth: number;
  theme: SessionHistoryLayoutTheme;
}): HistoryContentContainerStyle {
  return {
    alignSelf: "center",
    maxWidth: args.maxWidth,
    paddingBottom: sessionHistoryBottomPadding(args.theme),
    width: "100%",
  };
}

export { createHistoryContentContainerStyle, sessionHistoryBottomPadding };
export type { HistoryContentContainerStyle, SessionHistoryLayoutTheme };
