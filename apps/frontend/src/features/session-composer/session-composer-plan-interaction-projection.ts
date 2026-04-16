import type { TranscriptItem } from "@conduit/session-client";
import {
  ANSWER_OTHER_OPTION_ID,
  CANCEL_OPTION_ID,
  IMPLEMENT_PLAN_OPTION_ID,
  PROPOSED_PLAN_TAG,
} from "./session-composer-plan-interaction-backend-shape";
import type {
  BackendInteractionOption,
  BackendInteractionRequestData,
  BackendInteractionResolutionData,
  CollaborationMode,
} from "./session-composer-plan-interaction-backend-shape";
import type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
} from "./session-composer-plan-interaction-mock-scenarios";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInteractionRequestData(
  value: unknown,
): value is BackendInteractionRequestData {
  return (
    isRecord(value) &&
    value.sessionUpdate === "interaction_request" &&
    typeof value.interactionId === "string" &&
    typeof value.toolCallId === "string" &&
    typeof value.questionId === "string" &&
    typeof value.question === "string" &&
    Array.isArray(value.options)
  );
}

function isInteractionResolutionData(
  value: unknown,
): value is BackendInteractionResolutionData {
  return (
    isRecord(value) &&
    value.sessionUpdate === "interaction_resolution" &&
    typeof value.interactionId === "string" &&
    typeof value.status === "string"
  );
}

function interactionRequestData(
  item: TranscriptItem,
): BackendInteractionRequestData | null {
  if (item.kind !== "event" || item.variant !== "interaction_request") {
    return null;
  }
  if (!isInteractionRequestData(item.data)) {
    return null;
  }
  return item.data;
}

function interactionResolutionData(
  item: TranscriptItem,
): BackendInteractionResolutionData | null {
  if (item.kind !== "event" || item.variant !== "interaction_resolution") {
    return null;
  }
  if (!isInteractionResolutionData(item.data)) {
    return null;
  }
  return item.data;
}

function resolvedInteractionIds(items: TranscriptItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    const resolution = interactionResolutionData(item);
    if (resolution !== null) {
      ids.add(resolution.interactionId);
    }
  }
  return ids;
}

function optionFromBackend(
  option: BackendInteractionOption,
): PlanInteractionMockOption | null {
  if (option.optionId === CANCEL_OPTION_ID) {
    return null;
  }
  let kind: PlanInteractionMockOption["kind"] = "choice";
  if (option.optionId === ANSWER_OTHER_OPTION_ID) {
    kind = "other";
  }
  return {
    kind,
    label: option.name,
    optionId: option.optionId,
  };
}

function cardFromRequest(
  request: BackendInteractionRequestData,
): PlanInteractionMockCard {
  return {
    interactionId: request.interactionId,
    kind: "question",
    options: request.options.flatMap((option) => {
      const projected = optionFromBackend(option);
      if (projected === null) {
        return [];
      }
      return [projected];
    }),
    prompt: request.question,
    questionId: request.questionId,
    stepLabel: null,
    submitLabel: "Continue",
    title: request.questionHeader ?? "Question",
  };
}

function latestPendingQuestionCard(
  items: TranscriptItem[],
): PlanInteractionMockCard | null {
  const resolvedIds = resolvedInteractionIds(items);
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const request = interactionRequestData(items[index]);
    if (request !== null && !resolvedIds.has(request.interactionId)) {
      return cardFromRequest(request);
    }
  }
  return null;
}

function blockText(block: unknown): string {
  if (isRecord(block) && typeof block.text === "string") {
    return block.text;
  }
  return "";
}

function messageText(item: TranscriptItem): string {
  if (item.kind !== "message") {
    return "";
  }
  return item.content.map(blockText).join("");
}

function latestUnansweredProposedPlan(
  items: TranscriptItem[],
): TranscriptItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      return null;
    }
    if (
      item.kind === "message" &&
      item.role === "agent" &&
      messageText(item).includes(PROPOSED_PLAN_TAG)
    ) {
      return item;
    }
  }
  return null;
}

function terminalPlanCardFor(
  items: TranscriptItem[],
  collaborationMode: CollaborationMode,
): PlanInteractionMockCard | null {
  if (collaborationMode !== "plan") {
    return null;
  }
  const planItem = latestUnansweredProposedPlan(items);
  if (planItem === null) {
    return null;
  }
  return {
    interactionId: `terminal-plan:${planItem.id}`,
    kind: "terminal_decision",
    options: [
      {
        kind: "choice",
        label: "Yes, implement this plan",
        optionId: IMPLEMENT_PLAN_OPTION_ID,
      },
      {
        kind: "other",
        label: "No, and tell Codex what to do differently",
        optionId: ANSWER_OTHER_OPTION_ID,
      },
    ],
    prompt: "Implement this plan?",
    questionId: "terminal-plan",
    stepLabel: null,
    submitLabel: "Submit",
    title: "Plan Decision",
  };
}

function activePlanInteractionCard(args: {
  collaborationMode: CollaborationMode;
  items: TranscriptItem[];
}): PlanInteractionMockCard | null {
  return (
    latestPendingQuestionCard(args.items) ??
    terminalPlanCardFor(args.items, args.collaborationMode)
  );
}

function selectedOption(args: {
  card: PlanInteractionMockCard | null;
  selectedOptionId: string | null;
}): PlanInteractionMockOption | null {
  if (args.card === null || args.selectedOptionId === null) {
    return null;
  }
  return (
    args.card.options.find(
      (option) => option.optionId === args.selectedOptionId,
    ) ?? null
  );
}

function canSubmitPlanInteraction(args: {
  card: PlanInteractionMockCard | null;
  otherText: string;
  selectedOptionId: string | null;
}): boolean {
  const option = selectedOption({
    card: args.card,
    selectedOptionId: args.selectedOptionId,
  });
  if (option === null) {
    return false;
  }
  if (option.kind !== "other") {
    return true;
  }
  return args.otherText.trim().length > 0;
}

export {
  activePlanInteractionCard,
  canSubmitPlanInteraction,
  interactionRequestData,
  interactionResolutionData,
  selectedOption,
};
