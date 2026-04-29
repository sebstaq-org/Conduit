interface HistoryContentContainerStyle {
  alignSelf: "center";
  maxWidth: number;
  paddingBottom: number;
  width: "100%";
}

interface SessionHistoryLayoutTheme {
  spacing: {
    scrollBottom: number;
  };
}

function sessionHistoryBottomPadding(theme: SessionHistoryLayoutTheme): number {
  return theme.spacing.scrollBottom;
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

export {
  createHistoryContentContainerStyle,
  sessionHistoryBottomPadding,
};
export type { HistoryContentContainerStyle, SessionHistoryLayoutTheme };
