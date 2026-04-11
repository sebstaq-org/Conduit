const panelTokens = {
  colors: {
    background: "#ffffff",
    border: "#ececec",
    icon: "#8d8d8d",
    mutedText: "#b7b7b7",
    pressed: "#f1f1f1",
    text: "#5b5b5b",
  },
  font: {
    medium: "600" as const,
    regular: "400" as const,
  },
  radii: {
    panel: 8,
    row: 6,
  },
  sizes: {
    desktopPanelWidth: 414,
    icon: 18,
    iconButton: 28,
    iconGlyph: 16,
    rowHeight: 34,
  },
  space: {
    bottomY: 22,
    contentX: 22,
    footerY: 10,
    gap: 12,
    indent: 26,
    sectionY: 18,
    topY: 22,
  },
} as const;

export { panelTokens };
