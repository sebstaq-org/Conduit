import type {
  PlanInteractionMockCard,
  PlanInteractionMockScenario,
  PlanInteractionMockStep,
} from "./session-composer-plan-interaction-mock-scenarios";
import { resolvePlanInteractionMockScenario } from "./session-composer-plan-interaction-mock-scenarios";
import { appendMockTranscriptMessage } from "./session-composer-plan-interaction-mock-history";
import {
  IMPLEMENT_PLAN_USER_MESSAGE,
} from "./session-composer-plan-interaction-mock-model";
import type {
  SessionComposerPlanInteractionMockState,
} from "./session-composer-plan-interaction-mock-model";
import {
  canSubmitPlanInteractionMock,
  firstSelectableOptionId,
  resolveActivePlanInteractionMockCard,
  resolveActivePlanInteractionMockStep,
  resolvePlanInteractionMockScenarioForState,
  selectedOption,
} from "./session-composer-plan-interaction-mock-queries";

function createSessionComposerPlanInteractionMockState(
): SessionComposerPlanInteractionMockState {
  return {
    activeStepIndex: 0,
    activeScenarioId: null,
    historyItems: [],
    lastResolution: null,
    mode: "message",
    otherText: "",
    selectedOptionId: null,
  };
}

function completedPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
  lastResolution: string,
): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: null,
    activeStepIndex: 0,
    historyItems: state.historyItems,
    lastResolution,
    mode: "message",
    otherText: "",
    selectedOptionId: null,
  };
}

function activatePlanInteractionCard(
  state: SessionComposerPlanInteractionMockState,
  card: PlanInteractionMockCard,
): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: state.activeScenarioId,
    activeStepIndex: state.activeStepIndex,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
    mode: "interaction",
    otherText: "",
    selectedOptionId: firstSelectableOptionId(card),
  };
}

function nextAgentPlanStep(args: {
  scenario: PlanInteractionMockScenario;
  state: SessionComposerPlanInteractionMockState;
}): PlanInteractionMockStep | null {
  return args.scenario.steps[args.state.activeStepIndex] ?? null;
}

function appendAgentPlanStep(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  const step = resolveActivePlanInteractionMockStep(state);
  if (step?.kind !== "agent_plan") {
    return state;
  }
  const nextState = appendMockTranscriptMessage(state, "agent", step.markdown);
  return {
    activeScenarioId: nextState.activeScenarioId,
    activeStepIndex: state.activeStepIndex + 1,
    historyItems: nextState.historyItems,
    lastResolution: nextState.lastResolution,
    mode: nextState.mode,
    otherText: nextState.otherText,
    selectedOptionId: nextState.selectedOptionId,
  };
}

function advancePastAgentPlans(args: {
  scenario: PlanInteractionMockScenario;
  state: SessionComposerPlanInteractionMockState;
}): SessionComposerPlanInteractionMockState {
  let nextState: SessionComposerPlanInteractionMockState = args.state;
  let step: PlanInteractionMockStep | null = nextAgentPlanStep({
    scenario: args.scenario,
    state: nextState,
  });
  while (step?.kind === "agent_plan") {
    nextState = appendAgentPlanStep(nextState);
    step = nextAgentPlanStep({ scenario: args.scenario, state: nextState });
  }
  return nextState;
}

function advanceToNextPlanInteraction(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  const scenario = resolvePlanInteractionMockScenarioForState(state);
  if (scenario === null) {
    return completedPlanInteractionMock(state, "Mock interaction completed.");
  }
  const nextState = advancePastAgentPlans({ scenario, state });
  const step = nextAgentPlanStep({ scenario, state: nextState });
  if (step?.kind === "interaction") {
    return activatePlanInteractionCard(nextState, step.card);
  }
  return completedPlanInteractionMock(
    nextState,
    `Mock completed: ${scenario.label}`,
  );
}

function startPlanInteractionMockScenario(
  state: SessionComposerPlanInteractionMockState,
  scenarioId: string,
): SessionComposerPlanInteractionMockState {
  const scenario = resolvePlanInteractionMockScenario(scenarioId);
  if (scenario === null) {
    return state;
  }
  return advanceToNextPlanInteraction({
    activeStepIndex: 0,
    activeScenarioId: scenario.id,
    historyItems: [],
    lastResolution: null,
    mode: "interaction",
    otherText: "",
    selectedOptionId: null,
  });
}

function dismissPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  if (state.mode !== "interaction") {
    return state;
  }
  const scenario = resolvePlanInteractionMockScenario(state.activeScenarioId);
  let lastResolution = "Mock interaction dismissed.";
  if (scenario !== null) {
    lastResolution = `Mock dismissed: ${scenario.label}`;
  }
  return {
    activeScenarioId: null,
    activeStepIndex: 0,
    historyItems: state.historyItems,
    lastResolution,
    mode: "message",
    otherText: "",
    selectedOptionId: null,
  };
}

function selectPlanInteractionMockOption(
  state: SessionComposerPlanInteractionMockState,
  optionId: string,
): SessionComposerPlanInteractionMockState {
  const card = resolveActivePlanInteractionMockCard(state);
  const option = selectedOption(card, optionId);
  if (option === null) {
    return state;
  }
  let otherText = "";
  if (option.kind === "other") {
    otherText = state.otherText;
  }
  return {
    activeStepIndex: state.activeStepIndex,
    activeScenarioId: state.activeScenarioId,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
    mode: state.mode,
    otherText,
    selectedOptionId: option.optionId,
  };
}

function setPlanInteractionMockOtherText(
  state: SessionComposerPlanInteractionMockState,
  text: string,
): SessionComposerPlanInteractionMockState {
  return {
    activeStepIndex: state.activeStepIndex,
    activeScenarioId: state.activeScenarioId,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
    mode: state.mode,
    otherText: text,
    selectedOptionId: state.selectedOptionId,
  };
}

function nextStepState(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: state.activeScenarioId,
    activeStepIndex: state.activeStepIndex + 1,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
    mode: state.mode,
    otherText: "",
    selectedOptionId: null,
  };
}

function submitImplementPlanMock(
  state: SessionComposerPlanInteractionMockState,
  scenario: PlanInteractionMockScenario | null,
): SessionComposerPlanInteractionMockState {
  const nextState = appendMockTranscriptMessage(
    state,
    "user",
    IMPLEMENT_PLAN_USER_MESSAGE,
  );
  return completedPlanInteractionMock(
    nextState,
    `Mock completed: ${scenario?.label ?? "Plan interaction"}`,
  );
}

function continuePlanModeMock(
  state: SessionComposerPlanInteractionMockState,
  shouldAppendUserText: boolean,
): SessionComposerPlanInteractionMockState {
  let nextState = state;
  if (shouldAppendUserText) {
    nextState = appendMockTranscriptMessage(
      state,
      "user",
      state.otherText.trim(),
    );
  }
  return advanceToNextPlanInteraction(nextStepState(nextState));
}

function submitTerminalPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
  card: PlanInteractionMockCard,
): SessionComposerPlanInteractionMockState {
  const scenario = resolvePlanInteractionMockScenarioForState(state);
  const option = selectedOption(card, state.selectedOptionId);
  if (option === null) {
    return state;
  }
  if (option.optionId === "implement-now") {
    return submitImplementPlanMock(state, scenario);
  }
  return continuePlanModeMock(state, option.kind === "other");
}

function submitPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  if (!canSubmitPlanInteractionMock(state)) {
    return state;
  }
  const card = resolveActivePlanInteractionMockCard(state);
  if (card === null) {
    return completedPlanInteractionMock(state, "Mock interaction completed.");
  }
  if (card.kind === "terminal_decision") {
    return submitTerminalPlanInteractionMock(state, card);
  }
  return advanceToNextPlanInteraction(nextStepState(state));
}

export {
  canSubmitPlanInteractionMock,
  createSessionComposerPlanInteractionMockState,
  dismissPlanInteractionMock,
  resolveActivePlanInteractionMockCard,
  selectPlanInteractionMockOption,
  setPlanInteractionMockOtherText,
  startPlanInteractionMockScenario,
  submitPlanInteractionMock,
};
export type {
  SessionComposerPlanInteractionMockState,
};
