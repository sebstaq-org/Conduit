import { expect, it } from "vitest";
import {
  createNavigationPanelRows,
  createSessionRows,
} from "./navigation-panel-scroll-rows";

it("keeps New Chat at the top of sidebar actions by removing inline pairing rows", () => {
  // Per user contract: pairing controls must no longer live as permanent sidebar rows.
  // Do not change without an explicit product decision.
  expect(createNavigationPanelRows([])).toEqual([
    { kind: "heading", key: "heading" },
    { kind: "projectRows", key: "project-rows" },
    { kind: "projectsHeader", key: "projects-header" },
  ]);
});

it("surfaces open-session transport failures in the sidebar status row", () => {
  expect(
    createSessionRows({
      activeSession: null,
      data: { groups: [], isRefreshing: false, refreshedAt: null, revision: 1 },
      error: null,
      isError: false,
      isLoading: false,
      openSessionError: {
        error:
          "Relay message too large. The session response exceeded the relay frame limit.",
      },
      showOpenSessionError: true,
    }),
  ).toContainEqual({
    kind: "status",
    key: "status:open-error",
    label: "Session failed to open",
    meta: "Relay message too large. The session response exceeded the relay frame limit.",
  });
});
