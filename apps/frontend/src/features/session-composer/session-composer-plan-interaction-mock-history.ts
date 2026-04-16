import type {
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";
import { PLAN_MODE_UI_MOCK_OPEN_SESSION_ID } from "./session-composer-plan-interaction-mock-model";
import type { SessionComposerPlanInteractionMockState } from "./session-composer-plan-interaction-mock-model";

function createMockTranscriptMessage(args: {
  role: "agent" | "user";
  sequence: number;
  text: string;
}): TranscriptItem {
  return {
    content: [{ text: args.text, type: "text" }],
    id: `plan-mode-ui-mock-${args.sequence}`,
    kind: "message",
    role: args.role,
    status: "complete",
    turnId: `plan-mode-ui-mock-turn-${args.sequence}`,
  };
}

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
        role,
        sequence: state.historyItems.length + 1,
        text,
      }),
    ],
    lastResolution: state.lastResolution,
    mode: state.mode,
    otherText: state.otherText,
    selectedOptionId: state.selectedOptionId,
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
