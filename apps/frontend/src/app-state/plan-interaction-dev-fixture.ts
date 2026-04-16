import type { TranscriptItem } from "@conduit/session-client";
import { IMPLEMENT_PLAN_USER_MESSAGE } from "./plan-interaction-types";
import type {
  CollaborationMode,
  PlanInteractionCard,
  PlanInteractionRespondRequest,
} from "./plan-interaction-types";
import { resolvePlanInteractionFixtureScenario } from "./plan-interaction-fixture-data";
import { activePlanInteractionCard } from "./plan-interaction-projection";
import {
  interactionRequestItem,
  interactionResolutionItem,
  transcriptMessage,
} from "./plan-interaction-dev-wire";

interface PlanInteractionFixtureState {
  collaborationMode: CollaborationMode;
  historyItems: TranscriptItem[];
  lastResolution: string | null;
  scenarioId: string | null;
  stepIndex: number;
}

const PLAN_INTERACTION_DEV_OPEN_SESSION_ID = "plan-interaction-dev-fixture";

function createPlanInteractionFixtureState(): PlanInteractionFixtureState {
  return {
    collaborationMode: "plan",
    historyItems: [],
    lastResolution: null,
    scenarioId: null,
    stepIndex: 0,
  };
}

function historyItemsAfterAgentSteps(
  state: PlanInteractionFixtureState,
): PlanInteractionFixtureState {
  const scenario = resolvePlanInteractionFixtureScenario(state.scenarioId);
  if (scenario === null) {
    return state;
  }
  let nextState = state;
  let step = scenario.steps[nextState.stepIndex] ?? null;
  while (step?.kind === "agent_plan") {
    nextState = {
      collaborationMode: nextState.collaborationMode,
      historyItems: [
        ...nextState.historyItems,
        transcriptMessage({
          items: nextState.historyItems,
          role: "agent",
          text: step.markdown,
        }),
      ],
      lastResolution: nextState.lastResolution,
      scenarioId: nextState.scenarioId,
      stepIndex: nextState.stepIndex + 1,
    };
    step = scenario.steps[nextState.stepIndex] ?? null;
  }
  return nextState;
}

function nextStateAfterSingleAgentPlan(
  state: PlanInteractionFixtureState,
): PlanInteractionFixtureState | null {
  const scenario = resolvePlanInteractionFixtureScenario(state.scenarioId);
  const step = scenario?.steps[state.stepIndex] ?? null;
  if (step?.kind !== "agent_plan") {
    return null;
  }
  return {
    collaborationMode: state.collaborationMode,
    historyItems: [
      ...state.historyItems,
      transcriptMessage({
        items: state.historyItems,
        role: "agent",
        text: step.markdown,
      }),
    ],
    lastResolution: state.lastResolution,
    scenarioId: state.scenarioId,
    stepIndex: state.stepIndex + 1,
  };
}

function completedScenarioState(args: {
  label: string;
  state: PlanInteractionFixtureState;
}): PlanInteractionFixtureState {
  return {
    collaborationMode: args.state.collaborationMode,
    historyItems: args.state.historyItems,
    lastResolution: `Fixture completed: ${args.label}`,
    scenarioId: null,
    stepIndex: 0,
  };
}

function stateWithInteractionRequest(args: {
  card: PlanInteractionCard;
  state: PlanInteractionFixtureState;
}): PlanInteractionFixtureState {
  return {
    collaborationMode: args.state.collaborationMode,
    historyItems: [
      ...args.state.historyItems,
      interactionRequestItem({
        card: args.card,
        items: args.state.historyItems,
      }),
    ],
    lastResolution: args.state.lastResolution,
    scenarioId: args.state.scenarioId,
    stepIndex: args.state.stepIndex + 1,
  };
}

function advanceAfterAgentPlans(args: {
  label: string;
  state: PlanInteractionFixtureState;
}): PlanInteractionFixtureState {
  const scenario = resolvePlanInteractionFixtureScenario(args.state.scenarioId);
  if (scenario === null) {
    return args.state;
  }
  const nextState = historyItemsAfterAgentSteps(args.state);
  const step = scenario.steps[nextState.stepIndex] ?? null;
  if (step?.kind !== "interaction") {
    return completedScenarioState({ label: args.label, state: nextState });
  }
  if (step.card.kind === "terminal_decision") {
    return nextState;
  }
  return stateWithInteractionRequest({ card: step.card, state: nextState });
}

function advancePlanInteractionFixture(
  state: PlanInteractionFixtureState,
): PlanInteractionFixtureState {
  const scenario = resolvePlanInteractionFixtureScenario(state.scenarioId);
  if (scenario === null) {
    return state;
  }
  const planState = nextStateAfterSingleAgentPlan(state);
  if (planState !== null) {
    return planState;
  }
  return advanceAfterAgentPlans({ label: scenario.label, state });
}

function startPlanInteractionFixture(
  state: PlanInteractionFixtureState,
  scenarioId: string,
): PlanInteractionFixtureState {
  const scenario = resolvePlanInteractionFixtureScenario(scenarioId);
  if (scenario === null) {
    return state;
  }
  return advancePlanInteractionFixture({
    collaborationMode: "plan",
    historyItems: [],
    lastResolution: null,
    scenarioId: scenario.id,
    stepIndex: 0,
  });
}

function appendResolution(args: {
  state: PlanInteractionFixtureState;
  request: PlanInteractionRespondRequest;
}): PlanInteractionFixtureState {
  const card = activePlanInteractionCard({
    items: args.state.historyItems,
  });
  if (
    card === null ||
    card.kind !== "question" ||
    card.interactionId !== args.request.interactionId
  ) {
    return args.state;
  }
  return {
    collaborationMode: args.state.collaborationMode,
    historyItems: [
      ...args.state.historyItems,
      interactionResolutionItem({
        interactionId: card.interactionId,
        items: args.state.historyItems,
        rawOutput: { request_type: "request_user_input", response: args.request.response },
        status: "resolved",
      }),
    ],
    lastResolution: args.state.lastResolution,
    scenarioId: args.state.scenarioId,
    stepIndex: args.state.stepIndex,
  };
}

function respondPlanInteractionFixture(
  state: PlanInteractionFixtureState,
  request: PlanInteractionRespondRequest,
): PlanInteractionFixtureState {
  if (request.openSessionId !== PLAN_INTERACTION_DEV_OPEN_SESSION_ID) {
    return state;
  }
  return advancePlanInteractionFixture(appendResolution({ request, state }));
}

function promptPlanInteractionFixture(
  state: PlanInteractionFixtureState,
  text: string,
): PlanInteractionFixtureState {
  const nextState = {
    collaborationMode: state.collaborationMode,
    historyItems: [
      ...state.historyItems,
      transcriptMessage({ items: state.historyItems, role: "user", text }),
    ],
    lastResolution: state.lastResolution,
    scenarioId: state.scenarioId,
    stepIndex: state.stepIndex,
  };
  if (text === IMPLEMENT_PLAN_USER_MESSAGE) {
    return {
      collaborationMode: "default",
      historyItems: nextState.historyItems,
      lastResolution: "Fixture completed: Product flow",
      scenarioId: null,
      stepIndex: 0,
    };
  }
  if (nextState.collaborationMode === "plan") {
    return advancePlanInteractionFixture(nextState);
  }
  return nextState;
}

export {
  PLAN_INTERACTION_DEV_OPEN_SESSION_ID,
  createPlanInteractionFixtureState,
  promptPlanInteractionFixture,
  respondPlanInteractionFixture,
  startPlanInteractionFixture,
};
export type { PlanInteractionFixtureState };
