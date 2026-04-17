import { useState } from "react";
import { useSelector } from "react-redux";
import {
  PLAN_INTERACTION_DEV_OPEN_SESSION_ID,
  createPlanInteractionFixtureState,
  promptPlanInteractionFixture,
  respondPlanInteractionFixture,
  startPlanInteractionFixture,
} from "./plan-interaction-dev-fixture";
import { usePlanInteractionController } from "./plan-interaction-controller-hook";
import { interactionResolutionData } from "./plan-interaction-projection";
import {
  usePromptSessionMutation,
  useRespondInteractionMutation,
  useSetSessionConfigOptionMutation,
} from "./api-hooks";
import { selectActiveSession } from "./session-selection";
import { useSessionTimeline } from "./session-timeline";
import type {
  CollaborationMode,
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionController,
} from "./plan-interaction-types";
import { COLLABORATION_MODE_CONFIG_ID } from "./plan-interaction-types";
import type { ActiveSession } from "./session-selection";
import type { PlanInteractionFixtureState } from "./plan-interaction-dev-fixture";
import type {
  SessionConfigOption,
  SessionHistoryWindow,
} from "@conduit/session-client";

const PLAN_INTERACTION_DEV_FIXTURE_ENV =
  "EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE";
const PLAN_INTERACTION_DEV_FIXTURE_SCENARIO_ENV =
  "EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE_SCENARIO";

declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE?: string;
    readonly EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE_SCENARIO?: string;
  };
};

function readPlanInteractionFixtureFlag(rawValue?: string): boolean {
  if (rawValue === undefined) {
    return false;
  }
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function isPlanInteractionDevFixtureEnabled(): boolean {
  return readPlanInteractionFixtureFlag(
    process.env.EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE,
  );
}

function planInteractionDevFixtureScenarioId(): string {
  const scenarioId =
    process.env.EXPO_PUBLIC_CONDUIT_PLAN_INTERACTION_DEV_FIXTURE_SCENARIO;
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

function openSessionIdFor(activeSession: ActiveSession | null): string | null {
  if (activeSession?.kind !== "open") {
    return null;
  }
  return activeSession.openSessionId;
}

function isCodexOpenSession(
  activeSession: ActiveSession | null,
): activeSession is Extract<ActiveSession, { kind: "open" }> {
  return activeSession?.kind === "open" && activeSession.provider === "codex";
}

function collaborationModeFromConfigOptions(
  configOptions: SessionConfigOption[] | null,
): CollaborationMode {
  const option = configOptions?.find(
    (candidate) => candidate.id === COLLABORATION_MODE_CONFIG_ID,
  );
  if (option?.currentValue === "plan") {
    return "plan";
  }
  return "default";
}

function latestResolutionStatus(
  history: SessionHistoryWindow | undefined,
): string | null {
  if (history === undefined) {
    return null;
  }
  for (let index = history.items.length - 1; index >= 0; index -= 1) {
    const resolution = interactionResolutionData(history.items[index]);
    if (resolution !== null) {
      return resolution.status;
    }
  }
  return null;
}

function liveCollaborationMode(args: {
  activeSession: ActiveSession | null;
  enabled: boolean;
}): CollaborationMode {
  if (!args.enabled || args.activeSession?.kind !== "open") {
    return "default";
  }
  return collaborationModeFromConfigOptions(args.activeSession.configOptions);
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
    promptSession: async (text): Promise<void> => {
      setState((current) => promptPlanInteractionFixture(current, text));
      await Promise.resolve();
    },
    respondInteraction: async (request): Promise<void> => {
      setState((current) => respondPlanInteractionFixture(current, request));
      await Promise.resolve();
    },
    setCollaborationMode: async (value: CollaborationMode): Promise<void> => {
      setState((current) => ({
        collaborationMode: value,
        historyItems: current.historyItems,
        lastResolution: current.lastResolution,
        scenarioId: current.scenarioId,
        stepIndex: current.stepIndex,
      }));
      await Promise.resolve();
    },
  };
}

interface LivePortCommands {
  promptSession: ReturnType<typeof usePromptSessionMutation>[0];
  respondInteraction: ReturnType<typeof useRespondInteractionMutation>[0];
  setSessionConfigOption: ReturnType<
    typeof useSetSessionConfigOptionMutation
  >[0];
}

function useLivePortCommands(): LivePortCommands {
  const [promptSession] = usePromptSessionMutation();
  const [respondInteraction] = useRespondInteractionMutation();
  const [setSessionConfigOption] = useSetSessionConfigOptionMutation();
  return { promptSession, respondInteraction, setSessionConfigOption };
}

function createLivePort(args: {
  activeSession: ActiveSession | null;
  commands: LivePortCommands;
  enabled: boolean;
  openSessionId: string | null;
  timeline: ReturnType<typeof useSessionTimeline>;
}): PlanInteractionRuntimePort {
  return {
    collaborationMode: liveCollaborationMode({
      activeSession: args.activeSession,
      enabled: args.enabled,
    }),
    enabled: args.enabled,
    history: args.timeline.history ?? null,
    lastResolution: latestResolutionStatus(args.timeline.history),
    openSessionId: args.openSessionId,
    promptSession: async (text): Promise<void> => {
      if (args.openSessionId === null) {
        return;
      }
      await args.commands
        .promptSession({
          openSessionId: args.openSessionId,
          prompt: [{ text, type: "text" }],
        })
        .unwrap();
    },
    respondInteraction: async (request): Promise<void> => {
      await args.commands.respondInteraction(request).unwrap();
    },
    setCollaborationMode: async (value: CollaborationMode): Promise<void> => {
      if (!args.enabled || args.activeSession?.kind !== "open") {
        return;
      }
      await args.commands
        .setSessionConfigOption({
          configId: COLLABORATION_MODE_CONFIG_ID,
          provider: args.activeSession.provider,
          sessionId: args.activeSession.sessionId,
          value,
        })
        .unwrap();
    },
  };
}

function usePlanInteractionLivePort(): PlanInteractionRuntimePort {
  const activeSession = useSelector(selectActiveSession);
  const openSessionId = openSessionIdFor(activeSession);
  const timeline = useSessionTimeline(openSessionId);
  const commands = useLivePortCommands();
  const enabled = isCodexOpenSession(activeSession);
  return createLivePort({
    activeSession,
    commands,
    enabled,
    openSessionId,
    timeline,
  });
}

function usePlanInteractionSource(): SessionComposerPlanInteractionController {
  const fixturePort = usePlanInteractionFixturePort();
  const livePort = usePlanInteractionLivePort();
  let port = livePort;
  if (fixturePort.enabled) {
    port = fixturePort;
  }
  return usePlanInteractionController(port);
}

export {
  PLAN_INTERACTION_DEV_FIXTURE_ENV,
  PLAN_INTERACTION_DEV_FIXTURE_SCENARIO_ENV,
  isPlanInteractionDevFixtureEnabled,
  readPlanInteractionFixtureFlag,
  usePlanInteractionSource,
};
