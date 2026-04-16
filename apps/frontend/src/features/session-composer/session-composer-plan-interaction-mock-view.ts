import { PLAN_INTERACTION_MOCK_SCENARIOS } from "./session-composer-plan-interaction-mock-scenarios";
import type {
  SessionComposerPlanInteractionMockState,
  SessionComposerPlanInteractionMockView,
} from "./session-composer-plan-interaction-mock-model";
import {
  canSubmitPlanInteractionMock,
  resolveActivePlanInteractionMockCard,
} from "./session-composer-plan-interaction-mock-queries";

function buildSessionComposerPlanInteractionMockView(args: {
  enabled: boolean;
  state: SessionComposerPlanInteractionMockState;
}): SessionComposerPlanInteractionMockView {
  if (!args.enabled) {
    return {
      activeCard: null,
      canSubmit: false,
      enabled: false,
      lastResolution: null,
      otherText: "",
      scenarios: PLAN_INTERACTION_MOCK_SCENARIOS,
      selectedOptionId: null,
    };
  }
  return {
    activeCard: resolveActivePlanInteractionMockCard(args.state),
    canSubmit: canSubmitPlanInteractionMock(args.state),
    enabled: true,
    lastResolution: args.state.lastResolution,
    otherText: args.state.otherText,
    scenarios: PLAN_INTERACTION_MOCK_SCENARIOS,
    selectedOptionId: args.state.selectedOptionId,
  };
}

export { buildSessionComposerPlanInteractionMockView };
