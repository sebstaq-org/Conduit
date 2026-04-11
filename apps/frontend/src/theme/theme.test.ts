import { describe, expect, it, vi } from "vitest";
import { darkTheme, lightTheme } from "./theme";

vi.mock(import("@shopify/restyle"), () => ({
  createTheme: <Theme>(theme: Theme): Theme => theme,
}));

describe("frontend themes", () => {
  it("keeps light and dark theme color keys aligned", () => {
    expect(Object.keys(darkTheme.colors).toSorted()).toStrictEqual(
      Object.keys(lightTheme.colors).toSorted(),
    );
  });

  it("keeps the required responsive and text variant contract", () => {
    expect(lightTheme.breakpoints).toStrictEqual({ phone: 0, web: 768 });
    expect(Object.keys(lightTheme.textVariants).toSorted()).toStrictEqual([
      "defaults",
      "meta",
      "panelHeading",
      "rowLabel",
      "rowLabelMuted",
      "sectionTitle",
    ]);
  });
});
