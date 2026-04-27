import { expect, it, vi } from "vitest";
import { selectNavigationPanelSessionTarget } from "./navigation-panel-session-target";
import type { SelectNavigationPanelSessionTargetArgs } from "./navigation-panel-session-target";

type Dispatch = SelectNavigationPanelSessionTargetArgs["dispatch"];
type OpenSessionTargetHandler =
  SelectNavigationPanelSessionTargetArgs["onOpenSessionTarget"];

function dispatchRecording(calls: string[]): Dispatch {
  return (action): void => {
    calls.push(`dispatch:${action.type}:${action.payload?.cwd ?? ""}`);
  };
}

function openSessionTargetRecording(calls: string[]): OpenSessionTargetHandler {
  return vi.fn<OpenSessionTargetHandler>((target) => {
    calls.push(`open:${target.cwd}:${target.provider}:${target.sessionId}`);
  });
}

it("selects draft targets through the same panel selection callback", () => {
  // Per user contract: mobile navigation reacts to the tap before any draft state side effect can block drawer close.
  const calls: string[] = [];

  selectNavigationPanelSessionTarget({
    dispatch: dispatchRecording(calls),
    onOpenSessionTarget: openSessionTargetRecording(calls),
    onSessionTargetSelected: (target) => {
      calls.push(`selected:${target.kind}:${target.cwd}`);
    },
    target: { cwd: "/srv/devops", kind: "draft" },
  });

  expect(calls).toEqual([
    "selected:draft:/srv/devops",
    "dispatch:sessionSelection/draftSessionStarted:/srv/devops",
  ]);
});

it("selects open targets through the same panel selection callback", () => {
  // Per user contract: mobile navigation reacts to the tap before open-session I/O can block drawer close.
  const calls: string[] = [];

  selectNavigationPanelSessionTarget({
    dispatch: dispatchRecording(calls),
    onOpenSessionTarget: openSessionTargetRecording(calls),
    onSessionTargetSelected: (target) => {
      calls.push(`selected:${target.kind}:${target.cwd}`);
    },
    target: {
      cwd: "/srv/devops",
      kind: "open",
      provider: "codex",
      sessionId: "session-1",
      title: "Existing",
    },
  });

  expect(calls).toEqual([
    "selected:open:/srv/devops",
    "open:/srv/devops:codex:session-1",
  ]);
});
