import { describe, expect, it, vi } from "vitest";
import type {
  ActiveSession,
  SessionComposerPlanInteractionController,
} from "@/app-state";
import { shouldRenderSessionComposerDock } from "./session-composer-dock.contract";

function planInteraction(
  activeCard: SessionComposerPlanInteractionController["view"]["activeCard"],
): SessionComposerPlanInteractionController {
  return {
    actions: {
      dismissInteraction: vi.fn<() => void>(),
      selectOption: vi.fn<(optionId: string) => void>(),
      setOtherText: vi.fn<(text: string) => void>(),
      submitChoice: vi.fn<(optionId: string) => void>(),
      submitInteraction: vi.fn<() => void>(),
    },
    history: null,
    view: {
      activeCard,
      canSubmit: false,
      lastResolution: null,
      otherText: "",
      selectedOptionId: null,
    },
  };
}

function draftSession(): ActiveSession {
  return {
    cwd: "/srv/devops/repos/w2/Conduit",
    kind: "draft",
    provider: null,
    selectedConfigByProvider: {},
  };
}

describe("session composer dock contract", () => {
  it("hides the composer when there is no active session", () => {
    expect([
      shouldRenderSessionComposerDock(null, planInteraction(null)),
    ]).toEqual([false]);
  });

  it("shows the composer for draft and open session work", () => {
    expect([
      shouldRenderSessionComposerDock(draftSession(), planInteraction(null)),
    ]).toEqual([true]);
  });

  it("keeps interaction cards visible even if session selection clears", () => {
    expect([
      shouldRenderSessionComposerDock(
        null,
        planInteraction({
          interactionId: "interaction-1",
          kind: "question",
          options: [],
          prompt: "Pick one",
          questionId: "question-1",
          stepLabel: null,
          submitLabel: "Submit",
          title: "Question",
        }),
      ),
    ]).toEqual([true]);
  });
});
