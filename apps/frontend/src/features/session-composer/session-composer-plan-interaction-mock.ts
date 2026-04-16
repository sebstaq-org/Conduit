import { useState } from "react";
import {
  buildSessionComposerPlanInteractionMockView,
  createSessionComposerPlanInteractionMockState,
  dismissPlanInteractionMock,
  isPlanModeUiMockEnabled,
  planModeUiMockScenarioId,
  selectPlanInteractionMockOption,
  setPlanInteractionMockOtherText,
  startPlanInteractionMockScenario,
  submitPlanInteractionMock,
} from "./session-composer-plan-interaction-mock-state";
import type { SessionComposerPlanInteractionMockView } from "./session-composer-plan-interaction-mock-state";
import type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
} from "./session-composer-plan-interaction-mock-scenarios";

interface SessionComposerPlanInteractionMockActions {
  dismissInteraction: () => void;
  selectOption: (optionId: string) => void;
  setOtherText: (text: string) => void;
  startScenario: (scenarioId: string) => void;
  submitInteraction: () => void;
}

interface SessionComposerPlanInteractionMockController {
  actions: SessionComposerPlanInteractionMockActions;
  view: SessionComposerPlanInteractionMockView;
}

function createDisabledPlanInteractionMockActions(
  setState: React.Dispatch<
    React.SetStateAction<ReturnType<typeof createSessionComposerPlanInteractionMockState>>
  >,
): SessionComposerPlanInteractionMockActions {
  return {
    dismissInteraction: (): void => {
      setState((current) => current);
    },
    selectOption: (): void => {
      setState((current) => current);
    },
    setOtherText: (): void => {
      setState((current) => current);
    },
    startScenario: (): void => {
      setState((current) => current);
    },
    submitInteraction: (): void => {
      setState((current) => current);
    },
  };
}

function createEnabledPlanInteractionMockActions(
  setState: React.Dispatch<
    React.SetStateAction<ReturnType<typeof createSessionComposerPlanInteractionMockState>>
  >,
): SessionComposerPlanInteractionMockActions {
  return {
    dismissInteraction: (): void => {
      setState((current) => dismissPlanInteractionMock(current));
    },
    selectOption: (optionId: string): void => {
      setState((current) => selectPlanInteractionMockOption(current, optionId));
    },
    setOtherText: (text: string): void => {
      setState((current) => setPlanInteractionMockOtherText(current, text));
    },
    startScenario: (scenarioId: string): void => {
      setState((current) => startPlanInteractionMockScenario(current, scenarioId));
    },
    submitInteraction: (): void => {
      setState((current) => submitPlanInteractionMock(current));
    },
  };
}

function useSessionComposerPlanInteractionMock(): SessionComposerPlanInteractionMockController {
  const enabled = isPlanModeUiMockEnabled();
  const [state, setState] = useState(() => {
    let initialState = createSessionComposerPlanInteractionMockState();
    if (enabled) {
      initialState = startPlanInteractionMockScenario(
        initialState,
        planModeUiMockScenarioId(),
      );
    }
    return initialState;
  });
  let actions = createDisabledPlanInteractionMockActions(setState);
  if (enabled) {
    actions = createEnabledPlanInteractionMockActions(setState);
  }

  return {
    actions,
    view: buildSessionComposerPlanInteractionMockView({ enabled, state }),
  };
}

export { useSessionComposerPlanInteractionMock };
export type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
  SessionComposerPlanInteractionMockActions,
  SessionComposerPlanInteractionMockController,
  SessionComposerPlanInteractionMockView,
};
