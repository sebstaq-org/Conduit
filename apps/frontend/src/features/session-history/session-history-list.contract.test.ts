import { describe, expect, it } from "vitest";
import {
  createHistoryContentContainerStyle,
  sessionHistoryBottomPadding,
} from "./session-history-list-layout";

const layoutTheme = {
  panel: {
    composerSurfaceMinHeight: 98,
  },
  spacing: {
    contentTop: 22,
    scrollBottom: 24,
  },
};

describe("session history list layout contract", () => {
  it("reserves enough bottom space for the docked composer", () => {
    const style = createHistoryContentContainerStyle({
      maxWidth: 760,
      theme: layoutTheme,
    });

    expect(style).toEqual({
      alignSelf: "center",
      maxWidth: 760,
      paddingBottom: sessionHistoryBottomPadding(layoutTheme),
      width: "100%",
    });
    expect(sessionHistoryBottomPadding(layoutTheme)).toBe(
      layoutTheme.spacing.scrollBottom +
        layoutTheme.panel.composerSurfaceMinHeight +
        layoutTheme.spacing.contentTop,
    );
  });
});
