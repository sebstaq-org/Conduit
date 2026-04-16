import { describe, expect, it } from "vitest";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-state";
import {
  createSessionComposerPlanInteractionMockState,
  readPlanModeUiMockFlag,
  selectPlanInteractionMockOption,
  setPlanInteractionMockOtherText,
  startPlanInteractionMockScenario,
  submitPlanInteractionMock,
} from "./session-composer-plan-interaction-mock-state";

function completeTwoQuestionScenario(): SessionComposerPlanInteractionMockState {
  const started = startPlanInteractionMockScenario(
    createSessionComposerPlanInteractionMockState(),
    "two-questions",
  );
  const afterFirstSubmit = submitPlanInteractionMock(started);
  return submitPlanInteractionMock(afterFirstSubmit);
}

function completeImplementOtherScenario(): SessionComposerPlanInteractionMockState {
  const started = startPlanInteractionMockScenario(
    createSessionComposerPlanInteractionMockState(),
    "implement-decision",
  );
  const selectedOther = selectPlanInteractionMockOption(started, "answer-other");
  const withOtherText = setPlanInteractionMockOtherText(
    selectedOther,
    "Behåll plan mode.",
  );
  return submitPlanInteractionMock(withOtherText);
}

describe("session composer plan interaction mock state", () => {
  it("advances through the two-question scenario and returns to message mode", () => {
    const state = completeTwoQuestionScenario();
    expect({
      activeScenarioId: state.activeScenarioId,
      lastResolution: state.lastResolution,
      mode: state.mode,
    }).toStrictEqual({
      activeScenarioId: null,
      lastResolution: "Mock completed: Mock: två frågor",
      mode: "message",
    });
  });

  it("requires text for Other before submit closes the interaction", () => {
    let state = createSessionComposerPlanInteractionMockState();
    state = startPlanInteractionMockScenario(state, "implement-decision");
    state = selectPlanInteractionMockOption(state, "answer-other");

    const blocked = submitPlanInteractionMock(state);
    expect(blocked.mode).toBe("interaction");
    expect(blocked.activeScenarioId).toBe("implement-decision");

    const resolved = completeImplementOtherScenario();
    expect({
      lastResolution: resolved.lastResolution,
      mode: resolved.mode,
    }).toStrictEqual({
      lastResolution: "Mock completed: Mock: implement-beslut",
      mode: "message",
    });
  });
});

describe("plan mode mock env flag", () => {
  it("accepts true-like values and rejects empty values", () => {
    expect([
      readPlanModeUiMockFlag(),
      readPlanModeUiMockFlag(""),
      readPlanModeUiMockFlag("1"),
      readPlanModeUiMockFlag("true"),
      readPlanModeUiMockFlag("TRUE"),
    ]).toStrictEqual([false, false, true, true, true]);
  });
});
