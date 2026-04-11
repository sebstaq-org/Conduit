const panelTokens = {
  colors: {
    background: "#ffffff",
    border: "#ececec",
    icon: "#8d8d8d",
    mutedText: "#b7b7b7",
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
    rowHeight: 34,
  },
  space: {
    contentX: 22,
    gap: 12,
    indent: 26,
    sectionY: 18,
    topY: 34,
  },
} as const;

export { panelTokens };
