import type {
  PlanInteractionMockCard,
  PlanInteractionMockScenario,
} from "./session-composer-plan-interaction-mock-scenarios";
import { resolvePlanInteractionMockScenario } from "./session-composer-plan-interaction-mock-scenarios";
import {
  ANSWER_OTHER_OPTION_ID,
  IMPLEMENT_PLAN_OPTION_ID,
  IMPLEMENT_PLAN_USER_MESSAGE,
  PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
  createMockTranscriptMessage,
} from "./session-composer-plan-interaction-backend-shape";
import type {
  SessionComposerPlanInteractionMockState,
} from "./session-composer-plan-interaction-mock-model";
import {
  canSubmitPlanInteractionMock,
  resolveActivePlanInteractionMockCard,
  resolvePlanInteractionMockScenarioForState,
  selectedOption,
} from "./session-composer-plan-interaction-mock-queries";
import {
  appendInteractionResolution,
  respondPlanInteractionMock,
} from "./session-composer-plan-interaction-mock-commands";
import type {
  MockRespondInteractionRequest,
  MockRespondInteractionResult,
} from "./session-composer-plan-interaction-mock-commands";
import {
  advanceToNextPlanInteraction,
  completedPlanInteractionMock,
  createSessionComposerPlanInteractionMockState,
  startPlanInteractionMockScenario,
} from "./session-composer-plan-interaction-mock-runner";

function dismissPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  const card = resolveActivePlanInteractionMockCard(state);
  if (card === null) {
    return state;
  }
  const scenario = resolvePlanInteractionMockScenario(state.activeScenarioId);
  let lastResolution = "Mock interaction dismissed.";
  if (scenario !== null) {
    lastResolution = `Mock dismissed: ${scenario.label}`;
  }
  if (card.kind === "question") {
    return completedPlanInteractionMock(
      appendInteractionResolution({
        card,
        rawOutput: {
          outcome: "cancelled",
          request_type: "request_user_input",
        },
        state,
        status: "cancelled",
      }),
      lastResolution,
    );
  }
  return {
    activeScenarioId: null,
    activeStepIndex: 0,
    collaborationMode: "default",
    historyItems: state.historyItems,
    lastResolution,
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
    collaborationMode: state.collaborationMode,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
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
    collaborationMode: state.collaborationMode,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
    otherText: text,
    selectedOptionId: state.selectedOptionId,
  };
}

function submitImplementPlanMock(
  state: SessionComposerPlanInteractionMockState,
  scenario: PlanInteractionMockScenario | null,
): SessionComposerPlanInteractionMockState {
  const historyItems = [
    ...state.historyItems,
    createMockTranscriptMessage({
      items: state.historyItems,
      role: "user",
      text: IMPLEMENT_PLAN_USER_MESSAGE,
    }),
  ];
  return completedPlanInteractionMock(
    {
      activeScenarioId: state.activeScenarioId,
      activeStepIndex: state.activeStepIndex,
      collaborationMode: "default",
      historyItems,
      lastResolution: state.lastResolution,
      otherText: "",
      selectedOptionId: null,
    },
    `Mock completed: ${scenario?.label ?? "Plan interaction"}`,
  );
}

function continuePlanModeMock(
  state: SessionComposerPlanInteractionMockState,
  shouldAppendUserText: boolean,
): SessionComposerPlanInteractionMockState {
  let nextState = state;
  if (shouldAppendUserText) {
    nextState = {
      activeScenarioId: state.activeScenarioId,
      activeStepIndex: state.activeStepIndex,
      collaborationMode: state.collaborationMode,
      historyItems: [
        ...state.historyItems,
        createMockTranscriptMessage({
          items: state.historyItems,
          role: "user",
          text: state.otherText.trim(),
        }),
      ],
      lastResolution: state.lastResolution,
      otherText: "",
      selectedOptionId: null,
    };
  }
  return advanceToNextPlanInteraction(nextState);
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
  if (option.optionId === IMPLEMENT_PLAN_OPTION_ID) {
    return submitImplementPlanMock(state, scenario);
  }
  return continuePlanModeMock(state, option.kind === "other");
}

function advanceRespondedState(
  result: MockRespondInteractionResult,
): SessionComposerPlanInteractionMockState {
  if (result.ok) {
    return advanceToNextPlanInteraction(result.state);
  }
  return result.state;
}

function answerOtherRequest(args: {
  card: PlanInteractionMockCard;
  state: SessionComposerPlanInteractionMockState;
}): MockRespondInteractionRequest {
  return {
    interactionId: args.card.interactionId,
    openSessionId: PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
    response: {
      kind: "answer_other",
      optionId: ANSWER_OTHER_OPTION_ID,
      questionId: args.card.questionId,
      text: args.state.otherText,
    },
  };
}

function selectedRequest(args: {
  card: PlanInteractionMockCard;
  optionId: string;
}): MockRespondInteractionRequest {
  return {
    interactionId: args.card.interactionId,
    openSessionId: PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
    response: {
      kind: "selected",
      optionId: args.optionId,
    },
  };
}

function submitQuestionPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
  card: PlanInteractionMockCard,
): SessionComposerPlanInteractionMockState {
  const option = selectedOption(card, state.selectedOptionId);
  if (option === null) {
    return state;
  }
  if (option.optionId === ANSWER_OTHER_OPTION_ID) {
    return advanceRespondedState(
      respondPlanInteractionMock(state, answerOtherRequest({ card, state })),
    );
  }
  return advanceRespondedState(
    respondPlanInteractionMock(
      state,
      selectedRequest({ card, optionId: option.optionId }),
    ),
  );
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
  return submitQuestionPlanInteractionMock(state, card);
}

function submitPlanInteractionMockChoice(
  state: SessionComposerPlanInteractionMockState,
  optionId: string,
): SessionComposerPlanInteractionMockState {
  const selectedState = selectPlanInteractionMockOption(state, optionId);
  return submitPlanInteractionMock(selectedState);
}

export {
  canSubmitPlanInteractionMock,
  createSessionComposerPlanInteractionMockState,
  dismissPlanInteractionMock,
  selectPlanInteractionMockOption,
  setPlanInteractionMockOtherText,
  startPlanInteractionMockScenario,
  submitPlanInteractionMockChoice,
  submitPlanInteractionMock,
  respondPlanInteractionMock,
};
export type { MockRespondInteractionRequest, MockRespondInteractionResult };
