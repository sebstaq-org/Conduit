import type { TranscriptItem } from "@conduit/session-client";
import {
  ANSWER_OTHER_OPTION_ID,
  CANCEL_OPTION_ID,
  IMPLEMENT_PLAN_OPTION_ID,
} from "./plan-interaction-types";
import {
  interactionRequestData,
  interactionResolutionData,
  terminalPlanData,
} from "./protocol/plan-interaction-data";
import type {
  PlanInteractionCard,
  PlanInteractionOption,
} from "./plan-interaction-types";
import type {
  BackendInteractionOption,
  BackendInteractionRequestData,
  BackendTerminalPlanData,
} from "./protocol/plan-interaction-data";

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

function resolvedToolCallIds(items: TranscriptItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    const resolution = interactionResolutionData(item);
    if (resolution !== null) {
      ids.add(resolution.toolCallId);
    }
  }
  return ids;
}

function optionFromBackend(
  option: BackendInteractionOption,
): PlanInteractionOption | null {
  if (option.optionId === CANCEL_OPTION_ID) {
    return null;
  }
  let kind: PlanInteractionOption["kind"] = "choice";
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
): PlanInteractionCard {
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
): PlanInteractionCard | null {
  const resolvedIds = resolvedInteractionIds(items);
  const resolvedToolCalls = resolvedToolCallIds(items);
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const request = interactionRequestData(items[index]);
    if (
      request !== null &&
      !resolvedIds.has(request.interactionId) &&
      !resolvedToolCalls.has(request.toolCallId)
    ) {
      return cardFromRequest(request);
    }
  }
  return null;
}

function latestUnansweredTerminalPlan(
  items: TranscriptItem[],
): BackendTerminalPlanData | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === "message" && item.role === "user") {
      return null;
    }
    const plan = terminalPlanData(item);
    if (plan !== null) {
      return plan;
    }
  }
  return null;
}

function terminalPlanCardFor(
  items: TranscriptItem[],
): PlanInteractionCard | null {
  const plan = latestUnansweredTerminalPlan(items);
  if (plan === null) {
    return null;
  }
  return {
    interactionId: plan.interactionId,
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
  items: TranscriptItem[];
}): PlanInteractionCard | null {
  return (
    latestPendingQuestionCard(args.items) ?? terminalPlanCardFor(args.items)
  );
}

function selectedPlanInteractionOption(args: {
  card: PlanInteractionCard | null;
  selectedOptionId: string | null;
}): PlanInteractionOption | null {
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
  card: PlanInteractionCard | null;
  otherText: string;
  selectedOptionId: string | null;
}): boolean {
  const option = selectedPlanInteractionOption({
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
  selectedPlanInteractionOption,
  terminalPlanData,
};
