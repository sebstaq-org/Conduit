import { expect, it } from "vitest";
import { createNavigationPanelRows } from "./navigation-panel-scroll-rows";

it("keeps New Chat at the top of sidebar actions by removing inline pairing rows", () => {
  // Per user contract: pairing controls must no longer live as permanent sidebar rows.
  // Do not change without an explicit product decision.
  expect(createNavigationPanelRows([])).toEqual([
    { kind: "heading", key: "heading" },
    { kind: "projectRows", key: "project-rows" },
    { kind: "projectsHeader", key: "projects-header" },
  ]);
});
