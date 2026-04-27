import type { TranscriptItem } from "@conduit/session-client";
import type {
  InteractionResolutionStatus,
  PlanInteractionCard,
} from "./plan-interaction-types";
import type {
  BackendInteractionOption,
  BackendInteractionRequestData,
  BackendInteractionResolutionData,
} from "./protocol/plan-interaction-data";

const DEV_ANSWER_OTHER_OPTION_ID = "answer-other";
const DEV_CANCEL_OPTION_ID = "cancel";

function nextSequence(items: TranscriptItem[]): number {
  return items.length + 1;
}

function turnId(sequence: number): string {
  return `plan-interaction-dev-turn-${sequence}`;
}

function toolCallIdFor(interactionId: string): string {
  return `tool-${interactionId}`;
}

function transcriptMessage(args: {
  items: TranscriptItem[];
  role: "agent" | "user";
  text: string;
}): TranscriptItem {
  const sequence = nextSequence(args.items);
  return {
    content: [{ text: args.text, type: "text" }],
    id: `plan-interaction-dev-message-${sequence}`,
    kind: "message",
    role: args.role,
    status: "complete",
    turnId: turnId(sequence),
  };
}

function terminalPlanItem(args: {
  items: TranscriptItem[];
  markdown: string;
}): TranscriptItem {
  const sequence = nextSequence(args.items);
  const itemId = `fixture-plan-${sequence}`;
  return {
    data: {
      codexTurnId: turnId(sequence),
      interactionId: `terminal-plan:${itemId}`,
      itemId,
      planText: args.markdown,
      providerSource: "TurnItem::Plan",
      sessionUpdate: "terminal_plan",
      source: "codex.terminalPlan",
      status: "pending",
      threadId: "fixture-thread",
    },
    id: `plan-interaction-dev-terminal-plan-${sequence}`,
    kind: "event",
    source: "conduit",
    status: "complete",
    turnId: turnId(sequence),
    variant: "terminal_plan",
  };
}

function backendOptions(card: PlanInteractionCard): BackendInteractionOption[] {
  return [
    ...card.options.map((option) => ({
      kind: option.kind,
      name: option.label,
      optionId: option.optionId,
    })),
    {
      kind: "cancel",
      name: "Cancel",
      optionId: DEV_CANCEL_OPTION_ID,
    },
  ];
}

function interactionRequestItem(args: {
  card: PlanInteractionCard;
  items: TranscriptItem[];
}): TranscriptItem {
  const sequence = nextSequence(args.items);
  const isOther = args.card.options.some(
    (option) => option.optionId === DEV_ANSWER_OTHER_OPTION_ID,
  );
  const data: BackendInteractionRequestData = {
    interactionId: args.card.interactionId,
    isOther,
    options: backendOptions(args.card),
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
    toolCallId: toolCallIdFor(args.card.interactionId),
  };
  return {
    data,
    id: `plan-interaction-dev-event-${sequence}`,
    kind: "event",
    source: "provider",
    status: "complete",
    turnId: turnId(sequence),
    variant: "interaction_request",
  };
}

function interactionResolutionItem(args: {
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
    id: `plan-interaction-dev-event-${sequence}`,
    kind: "event",
    source: "provider",
    status: "complete",
    turnId: turnId(sequence),
    variant: "interaction_resolution",
  };
}

export {
  interactionRequestItem,
  interactionResolutionItem,
  terminalPlanItem,
  transcriptMessage,
};
