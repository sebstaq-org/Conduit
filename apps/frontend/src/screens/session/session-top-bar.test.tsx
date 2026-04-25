/* eslint-disable jest/no-untyped-mock-factory, vitest/prefer-import-in-mock */
import { describe, expect, it, vi } from "vitest";
import { renderSessionScreenTopBarChildren } from "./session-top-bar.contract";

vi.mock("@/theme", () => ({
  Box: "Box",
}));

vi.mock("@/features/host-pairing", () => ({
  HostPairingPopover: "HostPairingPopover",
}));

vi.mock("@/ui", () => ({
  IconButton: "IconButton",
}));

describe("session top bar contract", () => {
  it("keeps mobile pairing controls beside the hamburger instead of inside the drawer", () => {
    // Per user contract: mobile pairing lives in the session top bar so the drawer can start with New Chat again.
    // Do not change without an explicit product decision.
    const onOpenNavigationPanel = vi.fn<() => void>();
    const [navigationButton, pairingPopover] =
      renderSessionScreenTopBarChildren(onOpenNavigationPanel);

    expect(navigationButton.type).toBe("IconButton");
    expect(pairingPopover.type).toBe("HostPairingPopover");
  });
});
