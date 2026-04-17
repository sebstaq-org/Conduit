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
import { logFailure } from "./frontend-logger";
import type { Dispatch, SetStateAction } from "react";
import type { PlanInteractionLocalState } from "./plan-interaction-controller";
import { clearLocalCardState } from "./plan-interaction-controller";

function logPlanInteractionFailure(error: unknown, action: string): void {
  try {
    logFailure("frontend.plan_interaction.action.failed", error, { action });
  } catch {
    // Logging must not turn an already-failed interaction action into a UI crash.
  }
}

function runInteractionAction(action: string, task: () => Promise<void>): void {
  void (async (): Promise<void> => {
    try {
      await task();
    } catch (error) {
      logPlanInteractionFailure(error, action);
    }
  })();
}

async function dismissAction(args: {
  card: PlanInteractionCard | null;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): Promise<void> {
  const card = args.card;
  if (card === null || args.port.openSessionId === null) {
    return;
  }
  if (card.kind === "terminal_decision") {
    return;
  }
  await args.port.respondInteraction({
    interactionId: card.interactionId,
    openSessionId: args.port.openSessionId,
    response: { kind: "cancel" },
  });
  clearLocalCardState({ card, setState: args.setState });
}

async function submitTerminalChoice(args: {
  card: PlanInteractionCard;
  optionId: string;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): Promise<boolean> {
  if (args.optionId !== IMPLEMENT_PLAN_OPTION_ID) {
    return false;
  }
  await args.port.setCollaborationMode("default");
  await args.port.promptSession(IMPLEMENT_PLAN_USER_MESSAGE);
  clearLocalCardState({ card: args.card, setState: args.setState });
  return true;
}

async function submitChoiceAction(args: {
  card: PlanInteractionCard | null;
  optionId: string;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): Promise<void> {
  const card = args.card;
  if (card === null || args.port.openSessionId === null) {
    return;
  }
  if (card.kind === "terminal_decision") {
    const submitted = await submitTerminalChoice({
      card,
      optionId: args.optionId,
      port: args.port,
      setState: args.setState,
    });
    if (submitted) {
      return;
    }
  }
  await args.port.respondInteraction({
    interactionId: card.interactionId,
    openSessionId: args.port.openSessionId,
    response: { kind: "selected", optionId: args.optionId },
  });
  clearLocalCardState({ card, setState: args.setState });
}

async function submitInteractionAction(args: {
  card: PlanInteractionCard | null;
  port: PlanInteractionRuntimePort;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
  state: PlanInteractionLocalState;
}): Promise<void> {
  const card = args.card;
  const text = args.state.otherText.trim();
  if (card === null || args.port.openSessionId === null || text.length === 0) {
    return;
  }
  if (card.kind === "terminal_decision") {
    await args.port.promptSession(text);
    clearLocalCardState({ card, setState: args.setState });
    return;
  }
  await args.port.respondInteraction({
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
      runInteractionAction("dismiss", async () => {
        await dismissAction(args);
      });
    },
    selectOption: args.selectOption,
    setOtherText: args.setOtherText,
    submitChoice: (optionId: string): void => {
      runInteractionAction("submit_choice", async () => {
        await submitChoiceAction({
          card: args.card,
          optionId,
          port: args.port,
          setState: args.setState,
        });
      });
    },
    submitInteraction: (): void => {
      runInteractionAction("submit_interaction", async () => {
        await submitInteractionAction(args);
      });
    },
  };
}

export { createPlanInteractionActions };
