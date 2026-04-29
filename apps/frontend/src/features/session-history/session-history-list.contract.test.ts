import { describe, expect, it } from "vitest";
import {
  createHistoryContentContainerStyle,
  sessionHistoryBottomPadding,
  sessionHistoryBottomPaddingForDockHeight,
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
      composerDockHeight: 0,
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

  it("uses the measured dock height when the composer has laid out", () => {
    const style = createHistoryContentContainerStyle({
      composerDockHeight: 220,
      maxWidth: 760,
      theme: layoutTheme,
    });

    expect(style.paddingBottom).toBe(
      sessionHistoryBottomPaddingForDockHeight(layoutTheme, 220),
    );
    expect(style.paddingBottom).toBe(layoutTheme.spacing.scrollBottom + 220);
  });
});
