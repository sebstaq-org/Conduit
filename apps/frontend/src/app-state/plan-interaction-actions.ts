import {
  ANSWER_OTHER_OPTION_ID,
  IMPLEMENT_PLAN_OPTION_ID,
  IMPLEMENT_PLAN_USER_MESSAGE,
} from "./plan-interaction-types";
import type {
  PlanInteractionCard,
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionActions,
} from "./plan-interaction-types";
import type { Dispatch, SetStateAction } from "react";
import type { PlanInteractionLocalState } from "./plan-interaction-controller";
import { clearLocalCardState } from "./plan-interaction-controller";

function dismissAction(args: {
  card: PlanInteractionCard | null;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): void {
  const card = args.card;
  if (card === null || args.port.openSessionId === null) {
    return;
  }
  if (card.kind === "terminal_decision") {
    args.port.setCollaborationMode("default");
    clearLocalCardState({ card, setState: args.setState });
    return;
  }
  args.port.respondInteraction({
    interactionId: card.interactionId,
    openSessionId: args.port.openSessionId,
    response: { kind: "cancel" },
  });
  clearLocalCardState({ card, setState: args.setState });
}

function submitTerminalChoice(args: {
  card: PlanInteractionCard;
  optionId: string;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): boolean {
  if (args.optionId !== IMPLEMENT_PLAN_OPTION_ID) {
    return false;
  }
  args.port.setCollaborationMode("default");
  args.port.promptSession(IMPLEMENT_PLAN_USER_MESSAGE);
  clearLocalCardState({ card: args.card, setState: args.setState });
  return true;
}

function submitChoiceAction(args: {
  card: PlanInteractionCard | null;
  optionId: string;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): void {
  const card = args.card;
  if (card === null || args.port.openSessionId === null) {
    return;
  }
  if (
    card.kind === "terminal_decision" &&
    submitTerminalChoice({
      card,
      optionId: args.optionId,
      port: args.port,
      setState: args.setState,
    })
  ) {
    return;
  }
  args.port.respondInteraction({
    interactionId: card.interactionId,
    openSessionId: args.port.openSessionId,
    response: { kind: "selected", optionId: args.optionId },
  });
  clearLocalCardState({ card, setState: args.setState });
}

function submitInteractionAction(args: {
  card: PlanInteractionCard | null;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
  state: PlanInteractionLocalState;
}): void {
  const card = args.card;
  const text = args.state.otherText.trim();
  if (card === null || args.port.openSessionId === null || text.length === 0) {
    return;
  }
  if (card.kind === "terminal_decision") {
    args.port.promptSession(text);
    clearLocalCardState({ card, setState: args.setState });
    return;
  }
  args.port.respondInteraction({
    interactionId: card.interactionId,
    openSessionId: args.port.openSessionId,
    response: {
      kind: "answer_other",
      optionId: ANSWER_OTHER_OPTION_ID,
      questionId: card.questionId,
      text,
    },
  });
  clearLocalCardState({ card, setState: args.setState });
}

function createPlanInteractionActions(args: {
  card: PlanInteractionCard | null;
  port: PlanInteractionRuntimePort;
  selectOption: (optionId: string) => void;
  setOtherText: (text: string) => void;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
  state: PlanInteractionLocalState;
}): SessionComposerPlanInteractionActions {
  return {
    dismissInteraction: (): void => {
      dismissAction(args);
    },
    selectOption: args.selectOption,
    setOtherText: args.setOtherText,
    submitChoice: (optionId: string): void => {
      submitChoiceAction({
        card: args.card,
        optionId,
        port: args.port,
        setState: args.setState,
      });
    },
    submitInteraction: (): void => {
      submitInteractionAction(args);
    },
  };
}

export { createPlanInteractionActions };
