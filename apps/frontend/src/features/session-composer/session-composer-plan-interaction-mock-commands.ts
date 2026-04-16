import {
  ANSWER_OTHER_OPTION_ID,
  PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
  createInteractionResolutionItem,
} from "./session-composer-plan-interaction-backend-shape";
import type { InteractionResolutionStatus } from "./session-composer-plan-interaction-backend-shape";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";
import type { PlanInteractionMockCard } from "./session-composer-plan-interaction-mock-scenarios";
import { resolveActivePlanInteractionMockCard } from "./session-composer-plan-interaction-mock-queries";
import { interactionResolutionData } from "./session-composer-plan-interaction-projection";

type MockInteractionResponse =
  | {
      kind: "selected";
      optionId: string;
    }
  | {
      kind: "answer_other";
      optionId?: string;
      questionId: string;
      text: string;
    }
  | {
      kind: "cancel";
    };

interface MockRespondInteractionRequest {
  interactionId: string;
  openSessionId: string;
  response: MockInteractionResponse;
}

type MockRespondInteractionResult =
  | {
      ok: true;
      state: SessionComposerPlanInteractionMockState;
    }
  | {
      error: "interaction_resolved" | "interaction_unknown" | "invalid_params";
      ok: false;
      state: SessionComposerPlanInteractionMockState;
    };

function appendInteractionResolution(args: {
  card: PlanInteractionMockCard;
  rawOutput: Record<string, unknown>;
  state: SessionComposerPlanInteractionMockState;
  status: InteractionResolutionStatus;
}): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: args.state.activeScenarioId,
    activeStepIndex: args.state.activeStepIndex,
    collaborationMode: args.state.collaborationMode,
    historyItems: [
      ...args.state.historyItems,
      createInteractionResolutionItem({
        interactionId: args.card.interactionId,
        items: args.state.historyItems,
        rawOutput: args.rawOutput,
        status: args.status,
      }),
    ],
    lastResolution: args.state.lastResolution,
    otherText: "",
    selectedOptionId: null,
  };
}

function hasInteractionResolution(
  state: SessionComposerPlanInteractionMockState,
  interactionId: string,
): boolean {
  return state.historyItems.some(
    (item) => interactionResolutionData(item)?.interactionId === interactionId,
  );
}

function interactionError(
  state: SessionComposerPlanInteractionMockState,
  interactionId: string,
): MockRespondInteractionResult {
  if (hasInteractionResolution(state, interactionId)) {
    return { error: "interaction_resolved", ok: false, state };
  }
  return { error: "interaction_unknown", ok: false, state };
}

function resolvedInteractionResult(args: {
  card: PlanInteractionMockCard;
  rawOutput: Record<string, unknown>;
  state: SessionComposerPlanInteractionMockState;
}): MockRespondInteractionResult {
  return {
    ok: true,
    state: appendInteractionResolution({
      card: args.card,
      rawOutput: args.rawOutput,
      state: args.state,
      status: "resolved",
    }),
  };
}

function cancelledInteractionResult(args: {
  card: PlanInteractionMockCard;
  rawOutput: Record<string, unknown>;
  state: SessionComposerPlanInteractionMockState;
}): MockRespondInteractionResult {
  return {
    ok: true,
    state: appendInteractionResolution({
      card: args.card,
      rawOutput: args.rawOutput,
      state: args.state,
      status: "cancelled",
    }),
  };
}

function questionCardForRequest(
  state: SessionComposerPlanInteractionMockState,
  request: MockRespondInteractionRequest,
): PlanInteractionMockCard | MockRespondInteractionResult {
  const card = resolveActivePlanInteractionMockCard(state);
  if (request.openSessionId !== PLAN_MODE_UI_MOCK_OPEN_SESSION_ID) {
    return { error: "interaction_unknown", ok: false, state };
  }
  if (
    card === null ||
    card.kind !== "question" ||
    card.interactionId !== request.interactionId
  ) {
    return interactionError(state, request.interactionId);
  }
  return card;
}

function answerOtherResult(args: {
  card: PlanInteractionMockCard;
  response: Extract<MockInteractionResponse, { kind: "answer_other" }>;
  state: SessionComposerPlanInteractionMockState;
}): MockRespondInteractionResult {
  if (
    args.response.questionId !== args.card.questionId ||
    args.response.text.trim().length === 0
  ) {
    return { error: "invalid_params", ok: false, state: args.state };
  }
  return resolvedInteractionResult({
    card: args.card,
    rawOutput: {
      outcome: "selected",
      optionId: args.response.optionId ?? ANSWER_OTHER_OPTION_ID,
      request_user_input_response: {
        answers: {
          [args.card.questionId]: {
            answers: [args.response.text.trim()],
          },
        },
      },
      request_type: "request_user_input",
    },
    state: args.state,
  });
}

function selectedResult(args: {
  card: PlanInteractionMockCard;
  optionId: string;
  state: SessionComposerPlanInteractionMockState;
}): MockRespondInteractionResult {
  if (!args.card.options.some((option) => option.optionId === args.optionId)) {
    return cancelledInteractionResult({
      card: args.card,
      rawOutput: {
        optionId: args.optionId,
        outcome: "cancelled",
        request_type: "request_user_input",
      },
      state: args.state,
    });
  }
  return resolvedInteractionResult({
    card: args.card,
    rawOutput: {
      outcome: "selected",
      optionId: args.optionId,
      request_type: "request_user_input",
    },
    state: args.state,
  });
}

function respondPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
  request: MockRespondInteractionRequest,
): MockRespondInteractionResult {
  const card = questionCardForRequest(state, request);
  if ("ok" in card) {
    return card;
  }
  if (request.response.kind === "cancel") {
    return cancelledInteractionResult({
      card,
      rawOutput: { outcome: "cancelled", request_type: "request_user_input" },
      state,
    });
  }
  if (request.response.kind === "answer_other") {
    return answerOtherResult({ card, response: request.response, state });
  }
  return selectedResult({ card, optionId: request.response.optionId, state });
}

export { appendInteractionResolution, respondPlanInteractionMock };
export type { MockRespondInteractionRequest, MockRespondInteractionResult };
