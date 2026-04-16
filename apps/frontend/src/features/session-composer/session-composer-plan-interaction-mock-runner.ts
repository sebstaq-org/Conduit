import {
  createInteractionRequestItem,
  createMockTranscriptMessage,
} from "./session-composer-plan-interaction-backend-shape";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";
import {
  resolveActivePlanInteractionMockStep,
  resolvePlanInteractionMockScenarioForState,
} from "./session-composer-plan-interaction-mock-queries";
import type {
  PlanInteractionMockCard,
  PlanInteractionMockScenario,
  PlanInteractionMockStep,
} from "./session-composer-plan-interaction-mock-scenarios";
import { resolvePlanInteractionMockScenario } from "./session-composer-plan-interaction-mock-scenarios";

function createSessionComposerPlanInteractionMockState(): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: null,
    activeStepIndex: 0,
    collaborationMode: "plan",
    historyItems: [],
    lastResolution: null,
    otherText: "",
    selectedOptionId: null,
  };
}

function completedPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
  lastResolution: string,
): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: null,
    activeStepIndex: 0,
    collaborationMode: state.collaborationMode,
    historyItems: state.historyItems,
    lastResolution,
    otherText: "",
    selectedOptionId: null,
  };
}

function appendInteractionRequest(args: {
  card: PlanInteractionMockCard;
  state: SessionComposerPlanInteractionMockState;
}): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: args.state.activeScenarioId,
    activeStepIndex: args.state.activeStepIndex + 1,
    collaborationMode: args.state.collaborationMode,
    historyItems: [
      ...args.state.historyItems,
      createInteractionRequestItem({
        card: args.card,
        items: args.state.historyItems,
      }),
    ],
    lastResolution: args.state.lastResolution,
    otherText: "",
    selectedOptionId: null,
  };
}

function nextAgentPlanStep(args: {
  scenario: PlanInteractionMockScenario;
  state: SessionComposerPlanInteractionMockState;
}): PlanInteractionMockStep | null {
  return args.scenario.steps[args.state.activeStepIndex] ?? null;
}

function appendAgentPlanStep(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  const step = resolveActivePlanInteractionMockStep(state);
  if (step?.kind !== "agent_plan") {
    return state;
  }
  return {
    activeScenarioId: state.activeScenarioId,
    activeStepIndex: state.activeStepIndex + 1,
    collaborationMode: state.collaborationMode,
    historyItems: [
      ...state.historyItems,
      createMockTranscriptMessage({
        items: state.historyItems,
        role: "agent",
        text: step.markdown,
      }),
    ],
    lastResolution: state.lastResolution,
    otherText: state.otherText,
    selectedOptionId: state.selectedOptionId,
  };
}

function advancePastAgentPlans(args: {
  scenario: PlanInteractionMockScenario;
  state: SessionComposerPlanInteractionMockState;
}): SessionComposerPlanInteractionMockState {
  let nextState: SessionComposerPlanInteractionMockState = args.state;
  let step = nextAgentPlanStep({ scenario: args.scenario, state: nextState });
  while (step?.kind === "agent_plan") {
    nextState = appendAgentPlanStep(nextState);
    step = nextAgentPlanStep({ scenario: args.scenario, state: nextState });
  }
  return nextState;
}

function waitForTerminalDecision(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: state.activeScenarioId,
    activeStepIndex: state.activeStepIndex + 1,
    collaborationMode: state.collaborationMode,
    historyItems: state.historyItems,
    lastResolution: state.lastResolution,
    otherText: "",
    selectedOptionId: null,
  };
}

function advanceToNextPlanInteraction(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  const scenario = resolvePlanInteractionMockScenarioForState(state);
  if (scenario === null) {
    return completedPlanInteractionMock(state, "Mock interaction completed.");
  }
  const nextState = advancePastAgentPlans({ scenario, state });
  const step = nextAgentPlanStep({ scenario, state: nextState });
  if (step?.kind !== "interaction") {
    return completedPlanInteractionMock(
      nextState,
      `Mock completed: ${scenario.label}`,
    );
  }
  if (step.card.kind === "terminal_decision") {
    return waitForTerminalDecision(nextState);
  }
  return appendInteractionRequest({ card: step.card, state: nextState });
}

function startPlanInteractionMockScenario(
  state: SessionComposerPlanInteractionMockState,
  scenarioId: string,
): SessionComposerPlanInteractionMockState {
  const scenario = resolvePlanInteractionMockScenario(scenarioId);
  if (scenario === null) {
    return state;
  }
  return advanceToNextPlanInteraction({
    activeScenarioId: scenario.id,
    activeStepIndex: 0,
    collaborationMode: "plan",
    historyItems: [],
    lastResolution: null,
    otherText: "",
    selectedOptionId: null,
  });
}

export {
  advanceToNextPlanInteraction,
  completedPlanInteractionMock,
  createSessionComposerPlanInteractionMockState,
  startPlanInteractionMockScenario,
};
