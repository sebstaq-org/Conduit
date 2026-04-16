import { describe, expect, it } from "vitest";
import { readPlanModeUiMockFlag } from "./session-composer-plan-interaction-mock-env";
import { buildSessionComposerPlanInteractionMockHistory } from "./session-composer-plan-interaction-mock-history";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-state";
import {
  createSessionComposerPlanInteractionMockState,
  resolveActivePlanInteractionMockCard,
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

function startProductFlow(): SessionComposerPlanInteractionMockState {
  return startPlanInteractionMockScenario(
    createSessionComposerPlanInteractionMockState(),
    "product-flow",
  );
}

function expectActiveQuestion(
  state: SessionComposerPlanInteractionMockState,
  questionId: string,
): void {
  expect(resolveActivePlanInteractionMockCard(state)?.questionId).toBe(questionId);
}

function advanceToFirstPlanDecision(): SessionComposerPlanInteractionMockState {
  let state = startProductFlow();
  expectActiveQuestion(state, "question-theme");
  state = submitPlanInteractionMock(state);
  expectActiveQuestion(state, "question-detail-level");
  state = submitPlanInteractionMock(state);
  expectActiveQuestion(state, "question-implement-1");
  return state;
}

function stayInPlanMode(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  let nextState = selectPlanInteractionMockOption(state, "answer-other");
  nextState = setPlanInteractionMockOtherText(
    nextState,
    "Jättebra. Men ändra kaffe till JUICE",
  );
  return submitPlanInteractionMock(nextState);
}

function textItems(state: SessionComposerPlanInteractionMockState): string[] {
  return state.historyItems.map((item) => {
    if (item.kind !== "message") {
      return "";
    }
    const block = item.content[0];
    if (
      typeof block === "object" &&
      block !== null &&
      "text" in block &&
      typeof block.text === "string"
    ) {
      return block.text;
    }
    return "";
  });
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
});

describe("session composer product-flow mock state", () => {
  it("simulates plan markdown, stay in plan mode, repeated questions, and implement", () => {
    let state = advanceToFirstPlanDecision();
    expect(textItems(state)).toEqual([
      expect.stringContaining("## Proposed plan"),
    ]);

    state = stayInPlanMode(state);
    expectActiveQuestion(state, "question-followup");
    expect(textItems(state)).toEqual([
      expect.stringContaining("## Proposed plan"),
      "Jättebra. Men ändra kaffe till JUICE",
    ]);

    state = submitPlanInteractionMock(state);
    expectActiveQuestion(state, "question-implement-2");
    expect(textItems(state)).toEqual([
      expect.stringContaining("## Proposed plan"),
      "Jättebra. Men ändra kaffe till JUICE",
      expect.stringContaining("## Proposed plan"),
    ]);

    state = submitPlanInteractionMock(state);
    expect({
      lastMessage: textItems(state).at(-1),
      mode: state.mode,
    }).toStrictEqual({
      lastMessage: "Implement plan",
      mode: "message",
    });
  });

  it("builds a mock history window for the session history renderer", () => {
    const state = advanceToFirstPlanDecision();

    const history = buildSessionComposerPlanInteractionMockHistory({
      enabled: true,
      state,
    });
    expect(history).toMatchObject({
      items: [{ kind: "message", role: "agent" }],
      nextCursor: null,
      openSessionId: "plan-mode-ui-mock",
      revision: 1,
    });
  });
});

describe("session composer terminal interaction mock state", () => {
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
