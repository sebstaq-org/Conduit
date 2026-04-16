import type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
  PlanInteractionMockScenario,
  PlanInteractionMockStep,
} from "./session-composer-plan-interaction-mock-scenarios";
import { resolvePlanInteractionMockScenario } from "./session-composer-plan-interaction-mock-scenarios";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";

function resolvePlanInteractionMockScenarioForState(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockScenario | null {
  return resolvePlanInteractionMockScenario(state.activeScenarioId);
}

function resolveActivePlanInteractionMockStep(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockStep | null {
  if (state.mode !== "interaction") {
    return null;
  }
  const scenario = resolvePlanInteractionMockScenarioForState(state);
  if (scenario === null) {
    return null;
  }
  return scenario.steps[state.activeStepIndex] ?? null;
}

function resolveActivePlanInteractionMockCard(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockCard | null {
  const step = resolveActivePlanInteractionMockStep(state);
  if (step?.kind !== "interaction") {
    return null;
  }
  return step.card;
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
  if (card === null || selectedOptionId === null) {
    return null;
  }
  return (
    card.options.find((option) => option.optionId === selectedOptionId) ?? null
  );
}

function canSubmitPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): boolean {
  const card = resolveActivePlanInteractionMockCard(state);
  const option = selectedOption(card, state.selectedOptionId);
  if (option === null) {
    return false;
  }
  if (option.kind !== "other") {
    return true;
  }
  return state.otherText.trim().length > 0;
}

export {
  canSubmitPlanInteractionMock,
  firstSelectableOptionId,
  resolveActivePlanInteractionMockCard,
  resolveActivePlanInteractionMockStep,
  resolvePlanInteractionMockScenarioForState,
  selectedOption,
};
