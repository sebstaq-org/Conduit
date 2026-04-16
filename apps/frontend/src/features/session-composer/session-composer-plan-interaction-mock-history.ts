import type { SessionHistoryWindow } from "@conduit/session-client";
import {
  PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
  createMockTranscriptMessage,
} from "./session-composer-plan-interaction-backend-shape";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";

function appendMockTranscriptMessage(
  state: SessionComposerPlanInteractionMockState,
  role: "agent" | "user",
  text: string,
): SessionComposerPlanInteractionMockState {
  return {
    activeScenarioId: state.activeScenarioId,
    activeStepIndex: state.activeStepIndex,
    historyItems: [
      ...state.historyItems,
      createMockTranscriptMessage({
        items: state.historyItems,
        role,
        text,
      }),
    ],
    lastResolution: state.lastResolution,
    otherText: state.otherText,
    selectedOptionId: state.selectedOptionId,
    collaborationMode: state.collaborationMode,
  };
}

function buildSessionComposerPlanInteractionMockHistory(args: {
  enabled: boolean;
  state: SessionComposerPlanInteractionMockState;
}): SessionHistoryWindow | null {
  if (!args.enabled) {
    return null;
  }
  return {
    items: args.state.historyItems,
    nextCursor: null,
    openSessionId: PLAN_MODE_UI_MOCK_OPEN_SESSION_ID,
    revision: args.state.historyItems.length,
  };
}

export {
  appendMockTranscriptMessage,
  buildSessionComposerPlanInteractionMockHistory,
};
