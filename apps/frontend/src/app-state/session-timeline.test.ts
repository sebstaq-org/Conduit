import { describe, expect, it } from "vitest";
import { selectPendingPromptsForOpenSession } from "./session-timeline";
import type { SessionPendingPromptsState } from "./session-pending-prompts";

function rootStateWithPendingPrompts(
  byOpenSessionId: SessionPendingPromptsState["byOpenSessionId"],
): { sessionPendingPrompts: SessionPendingPromptsState } {
  return {
    sessionPendingPrompts: {
      byOpenSessionId,
      sequence: 0,
    },
  };
}

describe("session timeline pending prompt selector", () => {
  it("returns a stable empty array when no session is selected", () => {
    const state = rootStateWithPendingPrompts({});

    expect(selectPendingPromptsForOpenSession(state, null)).toBe(
      selectPendingPromptsForOpenSession(state, null),
    );
  });

  it("returns a stable empty array when the selected session has no pending prompts", () => {
    const state = rootStateWithPendingPrompts({});

    expect(selectPendingPromptsForOpenSession(state, "open-missing")).toBe(
      selectPendingPromptsForOpenSession(state, "open-missing"),
    );
  });
});
