import type { TranscriptItem } from "@conduit/session-client";
import type { PlanInteractionMockCard } from "./session-composer-plan-interaction-mock-scenarios";

type CollaborationMode = "default" | "plan";
type InteractionResolutionStatus = "cancelled" | "failed" | "resolved";

interface BackendInteractionOption {
  kind: string;
  name: string;
  optionId: string;
}

interface BackendInteractionRequestData {
  interactionId: string;
  isOther: boolean;
  options: BackendInteractionOption[];
  question: string;
  questionHeader: string | null;
  questionId: string;
  rawInput: {
    question: {
      header: string | null;
      id: string;
      isOther: boolean;
      question: string;
    };
  };
  requestType: "request_user_input";
  sessionUpdate: "interaction_request";
  status: "pending";
  toolCallId: string;
}

interface BackendInteractionResolutionData {
  interactionId: string;
  rawOutput: Record<string, unknown>;
  sessionUpdate: "interaction_resolution";
  status: InteractionResolutionStatus;
  toolCallId: string;
}

const ANSWER_OTHER_OPTION_ID = "answer-other";
const CANCEL_OPTION_ID = "cancel";
const COLLABORATION_MODE_CONFIG_ID = "collaboration_mode";
const IMPLEMENT_PLAN_OPTION_ID = "implement-now";
const IMPLEMENT_PLAN_USER_MESSAGE = "Implement plan";
const PLAN_MODE_UI_MOCK_OPEN_SESSION_ID = "plan-mode-ui-mock";
const PROPOSED_PLAN_TAG = "<proposed_plan>";

function toolCallIdFor(interactionId: string): string {
  return `tool-${interactionId}`;
}

function nextSequence(items: TranscriptItem[]): number {
  return items.length + 1;
}

function turnId(sequence: number): string {
  return `plan-mode-ui-mock-turn-${sequence}`;
}

function createMockTranscriptMessage(args: {
  items: TranscriptItem[];
  role: "agent" | "user";
  text: string;
}): TranscriptItem {
  const sequence = nextSequence(args.items);
  return {
    content: [{ text: args.text, type: "text" }],
    id: `plan-mode-ui-mock-message-${sequence}`,
    kind: "message",
    role: args.role,
    status: "complete",
    turnId: turnId(sequence),
  };
}

function backendOptionsForCard(
  card: PlanInteractionMockCard,
): BackendInteractionOption[] {
  return [
    ...card.options.map((option) => ({
      kind: option.kind,
      name: option.label,
      optionId: option.optionId,
    })),
    {
      kind: "cancel",
      name: "Cancel",
      optionId: CANCEL_OPTION_ID,
    },
  ];
}

function createInteractionRequestItem(args: {
  card: PlanInteractionMockCard;
  items: TranscriptItem[];
}): TranscriptItem {
  const sequence = nextSequence(args.items);
  const toolCallId = toolCallIdFor(args.card.interactionId);
  const isOther = args.card.options.some(
    (option) => option.optionId === ANSWER_OTHER_OPTION_ID,
  );
  const data: BackendInteractionRequestData = {
    interactionId: args.card.interactionId,
    isOther,
    options: backendOptionsForCard(args.card),
    question: args.card.prompt,
    questionHeader: args.card.title,
    questionId: args.card.questionId,
    rawInput: {
      question: {
        header: args.card.title,
        id: args.card.questionId,
        isOther,
        question: args.card.prompt,
      },
    },
    requestType: "request_user_input",
    sessionUpdate: "interaction_request",
    status: "pending",
    toolCallId,
  };
  return {
    data,
    id: `plan-mode-ui-mock-event-${sequence}`,
    kind: "event",
    status: "complete",
    turnId: turnId(sequence),
    variant: "interaction_request",
  };
}

function createInteractionResolutionItem(args: {
  interactionId: string;
  items: TranscriptItem[];
  rawOutput: Record<string, unknown>;
  status: InteractionResolutionStatus;
}): TranscriptItem {
  const sequence = nextSequence(args.items);
  const data: BackendInteractionResolutionData = {
    interactionId: args.interactionId,
    rawOutput: args.rawOutput,
    sessionUpdate: "interaction_resolution",
    status: args.status,
    toolCallId: toolCallIdFor(args.interactionId),
  };
  return {
    data,
    id: `plan-mode-ui-mock-event-${sequence}`,
    kind: "event",
    status: "complete",
    turnId: turnId(sequence),
    variant: "interaction_resolution",
  };
}

export {
  ANSWER_OTHER_OPTION_ID,
  CANCEL_OPTION_ID,
  COLLABORATION_MODE_CONFIG_ID,
  IMPLEMENT_PLAN_OPTION_ID,
  IMPLEMENT_PLAN_USER_MESSAGE,
  PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
  PROPOSED_PLAN_TAG,
  createInteractionRequestItem,
  createInteractionResolutionItem,
  createMockTranscriptMessage,
};
export type {
  BackendInteractionRequestData,
  BackendInteractionResolutionData,
  BackendInteractionOption,
  CollaborationMode,
  InteractionResolutionStatus,
};
