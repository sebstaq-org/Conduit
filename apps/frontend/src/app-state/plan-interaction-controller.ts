import type { Dispatch, SetStateAction } from "react";
import type {
  PlanInteractionCard,
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionView,
} from "./plan-interaction-types";
import {
  activePlanInteractionCard,
  canSubmitPlanInteraction,
  selectedPlanInteractionOption,
} from "./plan-interaction-projection";

interface PlanInteractionLocalState {
  interactionId: string | null;
  otherText: string;
  selectedOptionId: string | null;
}

function createInitialLocalState(): PlanInteractionLocalState {
  return {
    interactionId: null,
    otherText: "",
    selectedOptionId: null,
  };
}

function activeCardFor(
  port: PlanInteractionRuntimePort,
): PlanInteractionCard | null {
  if (!port.enabled || port.history === null) {
    return null;
  }
  return activePlanInteractionCard({
    collaborationMode: port.collaborationMode,
    items: port.history.items,
  });
}

function localStateForCard(args: {
  card: PlanInteractionCard | null;
  state: PlanInteractionLocalState;
}): PlanInteractionLocalState {
  if (
    args.card === null ||
    args.state.interactionId !== args.card.interactionId
  ) {
    return createInitialLocalState();
  }
  return args.state;
}

function createView(args: {
  card: PlanInteractionCard | null;
  port: PlanInteractionRuntimePort;
  state: PlanInteractionLocalState;
}): SessionComposerPlanInteractionView {
  const state = localStateForCard({ card: args.card, state: args.state });
  return {
    activeCard: args.card,
    canSubmit: canSubmitPlanInteraction({
      card: args.card,
      otherText: state.otherText,
      selectedOptionId: state.selectedOptionId,
    }),
    lastResolution: args.port.lastResolution,
    otherText: state.otherText,
    selectedOptionId: state.selectedOptionId,
  };
}

function replaceLocalState(args: {
  interactionId: string | null;
  otherText: string;
  selectedOptionId: string | null;
}): PlanInteractionLocalState {
  return {
    interactionId: args.interactionId,
    otherText: args.otherText,
    selectedOptionId: args.selectedOptionId,
  };
}

function clearLocalCardState(args: {
  card: PlanInteractionCard;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): void {
  args.setState(() =>
    replaceLocalState({
      interactionId: args.card.interactionId,
      otherText: "",
      selectedOptionId: null,
    }),
  );
}

function selectOptionAction(args: {
  card: PlanInteractionCard | null;
  optionId: string;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
}): void {
  const card = args.card;
  const option = selectedPlanInteractionOption({
    card,
    selectedOptionId: args.optionId,
  });
  if (card === null || option === null) {
    return;
  }
  args.setState((current) => {
    let otherText = "";
    if (option.kind === "other") {
      otherText = current.otherText;
    }
    return replaceLocalState({
      interactionId: card.interactionId,
      otherText,
      selectedOptionId: option.optionId,
    });
  });
}

function setOtherTextAction(args: {
  card: PlanInteractionCard | null;
  setState: Dispatch<SetStateAction<PlanInteractionLocalState>>;
  text: string;
}): void {
  const card = args.card;
  if (card === null) {
    return;
  }
  args.setState((current) =>
    replaceLocalState({
      interactionId: card.interactionId,
      otherText: args.text,
      selectedOptionId: current.selectedOptionId,
    }),
  );
}

export {
  activeCardFor,
  clearLocalCardState,
  createInitialLocalState,
  createView,
  selectOptionAction,
  setOtherTextAction,
};
export type { PlanInteractionLocalState };
