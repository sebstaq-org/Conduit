import { expect, it } from "vitest";
import { draftSessionTarget, openSessionTarget } from "./session-list-target";
import type { SessionGroup, SessionRow } from "./session-list.types";

it("creates the same target contract for draft and existing session rows", () => {
  // Per user contract: draft rows and existing session rows share one selection path.
  // Do not split mobile/desktop navigation behavior back into row-specific flows.
  const session: SessionRow = {
    provider: "codex",
    sessionId: "session-1",
    title: "Existing",
    updatedAt: "2026-04-26T00:00:00Z",
  };
  const group: SessionGroup = {
    cwd: "/srv/devops",
    displayName: "devops",
    groupId: "group-1",
    sessions: [session],
  };

  expect(draftSessionTarget(group.cwd)).toEqual({
    cwd: "/srv/devops",
    kind: "draft",
  });
  expect(openSessionTarget(group, session)).toEqual({
    cwd: "/srv/devops",
    kind: "open",
    provider: "codex",
    sessionId: "session-1",
    title: "Existing",
  });
});
