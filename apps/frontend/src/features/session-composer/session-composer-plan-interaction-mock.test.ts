import { describe, expect, it } from "vitest";
import { readPlanModeUiMockFlag } from "./session-composer-plan-interaction-mock-env";
import { buildSessionComposerPlanInteractionMockHistory } from "./session-composer-plan-interaction-mock-history";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";
import { resolveActivePlanInteractionMockCard } from "./session-composer-plan-interaction-mock-queries";
import {
  createSessionComposerPlanInteractionMockState,
  selectPlanInteractionMockOption,
  setPlanInteractionMockOtherText,
  startPlanInteractionMockScenario,
  respondPlanInteractionMock,
  submitPlanInteractionMockChoice,
  submitPlanInteractionMock,
} from "./session-composer-plan-interaction-mock-state";
import {
  interactionRequestData,
  interactionResolutionData,
} from "./session-composer-plan-interaction-projection";

function completeTwoQuestionScenario(): SessionComposerPlanInteractionMockState {
  const started = startPlanInteractionMockScenario(
    createSessionComposerPlanInteractionMockState(),
    "two-questions",
  );
  const afterFirstSubmit = submitPlanInteractionMockChoice(
    started,
    "theme-everyday",
  );
  return submitPlanInteractionMockChoice(afterFirstSubmit, "scope-three-steps");
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
  state = submitPlanInteractionMockChoice(state, "theme-everyday");
  expectActiveQuestion(state, "question-detail-level");
  state = submitPlanInteractionMockChoice(state, "scope-three-steps");
  expectActiveQuestion(state, "terminal-plan");
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
  return state.historyItems.flatMap((item) => {
    if (item.kind !== "message") {
      return [];
    }
    const block = item.content[0];
    if (
      typeof block === "object" &&
      block !== null &&
      "text" in block &&
      typeof block.text === "string"
    ) {
      return [block.text];
    }
    return [];
  });
}

describe("session composer plan interaction mock state", () => {
  it("advances through the two-question scenario and returns to message mode", () => {
    const state = completeTwoQuestionScenario();
    expect({
      activeScenarioId: state.activeScenarioId,
      activeCard: resolveActivePlanInteractionMockCard(state),
      lastResolution: state.lastResolution,
    }).toStrictEqual({
      activeScenarioId: null,
      activeCard: null,
      lastResolution: "Mock completed: Mock: två frågor",
    });
  });
});

describe("session composer plan interaction backend-shaped mock", () => {
  it("emits backend-like interaction_request events", () => {
    const state = startPlanInteractionMockScenario(
      createSessionComposerPlanInteractionMockState(),
      "two-questions",
    );
    const request = interactionRequestData(state.historyItems[0]);

    expect(request).toMatchObject({
      interactionId: "mock-clarify-1",
      questionId: "question-theme",
      requestType: "request_user_input",
      sessionUpdate: "interaction_request",
      status: "pending",
      toolCallId: "tool-mock-clarify-1",
    });
    expect(request?.options.map((option) => option.optionId)).toContain("cancel");
  });
});

describe("session composer plan interaction response mock", () => {
  it("responds with backend-like selected resolution events", () => {
    const state = startPlanInteractionMockScenario(
      createSessionComposerPlanInteractionMockState(),
      "two-questions",
    );
    const result = respondPlanInteractionMock(state, {
      interactionId: "mock-clarify-1",
      openSessionId: "plan-mode-ui-mock",
      response: { kind: "selected", optionId: "theme-everyday" },
    });

    expect(result).toMatchObject({ ok: true });
    const resolution = interactionResolutionData(result.state.historyItems[1]);
    expect(resolution).toMatchObject({
      interactionId: "mock-clarify-1",
      sessionUpdate: "interaction_resolution",
      status: "resolved",
      toolCallId: "tool-mock-clarify-1",
    });
  });
});

describe("session composer plan interaction command errors", () => {
  it("returns deterministic unknown and resolved command errors", () => {
    const state = startPlanInteractionMockScenario(
      createSessionComposerPlanInteractionMockState(),
      "two-questions",
    );
    const unknown = respondPlanInteractionMock(state, {
      interactionId: "missing",
      openSessionId: "plan-mode-ui-mock",
      response: { kind: "selected", optionId: "theme-everyday" },
    });
    const selected = respondPlanInteractionMock(state, {
      interactionId: "mock-clarify-1",
      openSessionId: "plan-mode-ui-mock",
      response: { kind: "selected", optionId: "theme-everyday" },
    });
    if (!selected.ok) {
      throw new Error("selected response should be accepted");
    }
    const resolved = respondPlanInteractionMock(selected.state, {
      interactionId: "mock-clarify-1",
      openSessionId: "plan-mode-ui-mock",
      response: { kind: "selected", optionId: "theme-everyday" },
    });

    expect(unknown).toMatchObject({ error: "interaction_unknown", ok: false });
    expect(resolved).toMatchObject({ error: "interaction_resolved", ok: false });
  });
});

describe("session composer product-flow main path", () => {
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

    state = submitPlanInteractionMockChoice(state, "scope-narrow");
    expectActiveQuestion(state, "terminal-plan");
    expect(textItems(state)).toEqual([
      expect.stringContaining("## Proposed plan"),
      "Jättebra. Men ändra kaffe till JUICE",
      expect.stringContaining("## Proposed plan"),
    ]);

    state = submitPlanInteractionMockChoice(state, "implement-now");
    expect({
      lastMessage: textItems(state).at(-1),
      activeCard: resolveActivePlanInteractionMockCard(state),
      collaborationMode: state.collaborationMode,
    }).toStrictEqual({
      activeCard: null,
      collaborationMode: "default",
      lastMessage: "Implement plan",
    });
  });

});

describe("session composer product-flow choice handling", () => {
  it("submits choice options immediately without requiring text submit", () => {
    let state = startProductFlow();
    state = submitPlanInteractionMockChoice(state, "theme-everyday");
    expectActiveQuestion(state, "question-detail-level");

    state = selectPlanInteractionMockOption(state, "answer-other");
    const blocked = submitPlanInteractionMock(state);
    expectActiveQuestion(blocked, "question-detail-level");
  });

});

describe("session composer product-flow history", () => {
  it("builds a mock history window for the session history renderer", () => {
    const state = advanceToFirstPlanDecision();

    const history = buildSessionComposerPlanInteractionMockHistory({
      enabled: true,
      state,
    });
    expect(history).toMatchObject({
      items: [
        { kind: "event", variant: "interaction_request" },
        { kind: "event", variant: "interaction_resolution" },
        { kind: "event", variant: "interaction_request" },
        { kind: "event", variant: "interaction_resolution" },
        { kind: "message", role: "agent" },
      ],
      nextCursor: null,
      openSessionId: "plan-mode-ui-mock",
      revision: 5,
    });
  });
});

describe("session composer terminal interaction mock state", () => {
  it("requires text for Other before submit closes the interaction", () => {
    let state = createSessionComposerPlanInteractionMockState();
    state = startPlanInteractionMockScenario(state, "implement-decision");
    state = selectPlanInteractionMockOption(state, "answer-other");

    const blocked = submitPlanInteractionMock(state);
    expect(resolveActivePlanInteractionMockCard(blocked)?.kind).toBe(
      "terminal_decision",
    );
    expect(blocked.activeScenarioId).toBe("implement-decision");

    const resolved = completeImplementOtherScenario();
    expect({
      activeCard: resolveActivePlanInteractionMockCard(resolved),
      lastResolution: resolved.lastResolution,
    }).toStrictEqual({
      activeCard: null,
      lastResolution: "Mock completed: Mock: implement-beslut",
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
