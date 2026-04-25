/* eslint-disable jest/no-untyped-mock-factory, vitest/prefer-import-in-mock */
import { describe, expect, it, vi } from "vitest";
import { renderNavigationPanelHeaderChildren } from "./navigation-panel-header.contract";

vi.mock("@/theme", () => ({
  Box: "Box",
  Text: "Text",
}));

vi.mock("@/features/desktop-pairing", () => ({
  DesktopPairingPopover: "DesktopPairingPopover",
}));

vi.mock("@/features/host-pairing", () => ({
  HostPairingPopover: "HostPairingPopover",
}));

describe("navigation panel header contract", () => {
  it("renders the desktop pairing popover in the sidebar header for Electron", () => {
    // Per user contract: desktop pairing lives in the sidebar header, not as a standalone sidebar section.
    // Do not change without an explicit product decision.
    const [, pairingPopover] = renderNavigationPanelHeaderChildren(true);

    expect(pairingPopover.type).toBe("DesktopPairingPopover");
  });

  it("renders the host pairing popover in the sidebar header for non-desktop shells", () => {
    // Per user contract: wide non-desktop shells must keep a pairing entrypoint after the mobile move.
    // Do not change without an explicit product decision.
    const [, pairingPopover] = renderNavigationPanelHeaderChildren(false);

    expect(pairingPopover.type).toBe("HostPairingPopover");
  });
});
