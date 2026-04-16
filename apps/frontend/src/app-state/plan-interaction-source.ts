import { useState } from "react";
import {
  PLAN_INTERACTION_DEV_OPEN_SESSION_ID,
  createPlanInteractionFixtureState,
  promptPlanInteractionFixture,
  respondPlanInteractionFixture,
  startPlanInteractionFixture,
} from "./plan-interaction-dev-fixture";
import { usePlanInteractionController } from "./plan-interaction-controller-hook";
import type {
  CollaborationMode,
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionController,
} from "./plan-interaction-types";
import type { PlanInteractionFixtureState } from "./plan-interaction-dev-fixture";
import type { SessionHistoryWindow } from "@conduit/session-client";

const PLAN_INTERACTION_DEV_FIXTURE_ENV =
  "EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE";
const PLAN_INTERACTION_DEV_FIXTURE_SCENARIO_ENV =
  "EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE_SCENARIO";

function readPlanInteractionFixtureFlag(rawValue?: string): boolean {
  if (rawValue === undefined) {
    return false;
  }
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function isPlanInteractionDevFixtureEnabled(): boolean {
  return readPlanInteractionFixtureFlag(
    process.env[PLAN_INTERACTION_DEV_FIXTURE_ENV],
  );
}

function planInteractionDevFixtureScenarioId(): string {
  const scenarioId = process.env[PLAN_INTERACTION_DEV_FIXTURE_SCENARIO_ENV];
  if (scenarioId === undefined || scenarioId.trim().length === 0) {
    return "product-flow";
  }
  return scenarioId;
}

function initialFixtureState(enabled: boolean): PlanInteractionFixtureState {
  const state = createPlanInteractionFixtureState();
  if (!enabled) {
    return state;
  }
  return startPlanInteractionFixture(
    state,
    planInteractionDevFixtureScenarioId(),
  );
}

function fixtureHistory(args: {
  enabled: boolean;
  state: PlanInteractionFixtureState;
}): SessionHistoryWindow | null {
  if (!args.enabled) {
    return null;
  }
  return {
    items: args.state.historyItems,
    nextCursor: null,
    openSessionId: PLAN_INTERACTION_DEV_OPEN_SESSION_ID,
    revision: args.state.historyItems.length,
  };
}

function usePlanInteractionFixturePort(): PlanInteractionRuntimePort {
  const enabled = isPlanInteractionDevFixtureEnabled();
  const [state, setState] = useState(() => initialFixtureState(enabled));
  let openSessionId: string | null = null;
  if (enabled) {
    openSessionId = PLAN_INTERACTION_DEV_OPEN_SESSION_ID;
  }
  return {
    collaborationMode: state.collaborationMode,
    enabled,
    history: fixtureHistory({ enabled, state }),
    lastResolution: state.lastResolution,
    openSessionId,
    promptSession: (text): void => {
      setState((current) => promptPlanInteractionFixture(current, text));
    },
    respondInteraction: (request): void => {
      setState((current) => respondPlanInteractionFixture(current, request));
    },
    setCollaborationMode: (value: CollaborationMode): void => {
      setState((current) => ({
        collaborationMode: value,
        historyItems: current.historyItems,
        lastResolution: current.lastResolution,
        scenarioId: current.scenarioId,
        stepIndex: current.stepIndex,
      }));
    },
  };
}

function usePlanInteractionSource(): SessionComposerPlanInteractionController {
  const port = usePlanInteractionFixturePort();
  return usePlanInteractionController(port);
}

export {
  PLAN_INTERACTION_DEV_FIXTURE_ENV,
  PLAN_INTERACTION_DEV_FIXTURE_SCENARIO_ENV,
  isPlanInteractionDevFixtureEnabled,
  readPlanInteractionFixtureFlag,
  usePlanInteractionSource,
};
