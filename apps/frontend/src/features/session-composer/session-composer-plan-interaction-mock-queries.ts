import type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
  PlanInteractionMockScenario,
  PlanInteractionMockStep,
} from "./session-composer-plan-interaction-mock-scenarios";
import { resolvePlanInteractionMockScenario } from "./session-composer-plan-interaction-mock-scenarios";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";
import {
  activePlanInteractionCard,
  canSubmitPlanInteraction,
  selectedOption as selectedProjectedOption,
} from "./session-composer-plan-interaction-projection";

function resolvePlanInteractionMockScenarioForState(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockScenario | null {
  return resolvePlanInteractionMockScenario(state.activeScenarioId);
}

function resolveActivePlanInteractionMockStep(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockStep | null {
  const scenario = resolvePlanInteractionMockScenarioForState(state);
  if (scenario === null) {
    return null;
  }
  return scenario.steps[state.activeStepIndex] ?? null;
}

function resolveActivePlanInteractionMockCard(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockCard | null {
  return activePlanInteractionCard({
    collaborationMode: state.collaborationMode,
    items: state.historyItems,
  });
}

function firstSelectableOptionId(
  card: PlanInteractionMockCard | null,
): string | null {
  if (card === null) {
    return null;
  }
  return card.options[0]?.optionId ?? null;
}

function selectedOption(
  card: PlanInteractionMockCard | null,
  selectedOptionId: string | null,
): PlanInteractionMockOption | null {
  return selectedProjectedOption({ card, selectedOptionId });
}

function canSubmitPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): boolean {
  return canSubmitPlanInteraction({
    card: resolveActivePlanInteractionMockCard(state),
    otherText: state.otherText,
    selectedOptionId: state.selectedOptionId,
  });
}

export {
  canSubmitPlanInteractionMock,
  firstSelectableOptionId,
  resolveActivePlanInteractionMockCard,
  resolveActivePlanInteractionMockStep,
  resolvePlanInteractionMockScenarioForState,
  selectedOption,
};
