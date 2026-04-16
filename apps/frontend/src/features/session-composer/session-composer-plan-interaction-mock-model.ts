import type { TranscriptItem } from "@conduit/session-client";
import type { CollaborationMode } from "./session-composer-plan-interaction-backend-shape";
import type {
  PLAN_INTERACTION_MOCK_SCENARIOS,
  PlanInteractionMockCard,
} from "./session-composer-plan-interaction-mock-scenarios";

interface SessionComposerPlanInteractionMockState {
  activeScenarioId: string | null;
  activeStepIndex: number;
  collaborationMode: CollaborationMode;
  historyItems: TranscriptItem[];
  lastResolution: string | null;
  otherText: string;
  selectedOptionId: string | null;
}

interface SessionComposerPlanInteractionMockView {
  activeCard: PlanInteractionMockCard | null;
  canSubmit: boolean;
  enabled: boolean;
  lastResolution: string | null;
  otherText: string;
  scenarios: typeof PLAN_INTERACTION_MOCK_SCENARIOS;
  selectedOptionId: string | null;
}

const PLAN_MODE_UI_MOCK_ENV = "EXPO_PUBLIC_CONDUIT_PLAN_MODE_UI_MOCK";
const PLAN_MODE_UI_MOCK_SCENARIO_ENV =
  "EXPO_PUBLIC_CONDUIT_PLAN_MODE_UI_MOCK_SCENARIO";

export {
  PLAN_MODE_UI_MOCK_ENV,
  PLAN_MODE_UI_MOCK_SCENARIO_ENV,
};
export type {
  SessionComposerPlanInteractionMockState,
  SessionComposerPlanInteractionMockView,
};
