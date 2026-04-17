import type { SessionHistoryWindow } from "@conduit/session-client";

type CollaborationMode = "default" | "plan";
type InteractionResolutionStatus = "cancelled" | "failed" | "resolved";
type PlanInteractionCardKind = "question" | "terminal_decision";

interface PlanInteractionOption {
  kind: "choice" | "other";
  label: string;
  optionId: string;
}

interface PlanInteractionCard {
  interactionId: string;
  kind: PlanInteractionCardKind;
  options: readonly PlanInteractionOption[];
  prompt: string;
  questionId: string;
  stepLabel: string | null;
  submitLabel: string;
  title: string;
}

type PlanInteractionResponse =
  | {
      kind: "selected";
      optionId: string;
    }
  | {
      kind: "answer_other";
      optionId?: string;
      questionId: string;
      text: string;
    }
  | {
      kind: "cancel";
    };

interface PlanInteractionRespondRequest {
  interactionId: string;
  openSessionId: string;
  response: PlanInteractionResponse;
}

interface PlanInteractionRuntimePort {
  collaborationMode: CollaborationMode;
  enabled: boolean;
  history: SessionHistoryWindow | null;
  lastResolution: string | null;
  openSessionId: string | null;
  promptSession: (text: string) => Promise<void>;
  respondInteraction: (request: PlanInteractionRespondRequest) => Promise<void>;
  setCollaborationMode: (value: CollaborationMode) => Promise<void>;
}

interface SessionComposerPlanInteractionActions {
  dismissInteraction: () => void;
  selectOption: (optionId: string) => void;
  setOtherText: (text: string) => void;
  submitChoice: (optionId: string) => void;
  submitInteraction: () => void;
}

interface SessionComposerPlanInteractionView {
  activeCard: PlanInteractionCard | null;
  canSubmit: boolean;
  lastResolution: string | null;
  otherText: string;
  selectedOptionId: string | null;
}

interface SessionComposerPlanInteractionController {
  actions: SessionComposerPlanInteractionActions;
  history: SessionHistoryWindow | null;
  view: SessionComposerPlanInteractionView;
}

const ANSWER_OTHER_OPTION_ID = "answer-other";
const CANCEL_OPTION_ID = "cancel";
const COLLABORATION_MODE_CONFIG_ID = "collaboration_mode";
const IMPLEMENT_PLAN_OPTION_ID = "implement-now";
const IMPLEMENT_PLAN_USER_MESSAGE = "Implement plan";

export {
  ANSWER_OTHER_OPTION_ID,
  CANCEL_OPTION_ID,
  COLLABORATION_MODE_CONFIG_ID,
  IMPLEMENT_PLAN_OPTION_ID,
  IMPLEMENT_PLAN_USER_MESSAGE,
};
export type {
  CollaborationMode,
  InteractionResolutionStatus,
  PlanInteractionCard,
  PlanInteractionOption,
  PlanInteractionRespondRequest,
  PlanInteractionResponse,
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionActions,
  SessionComposerPlanInteractionController,
  SessionComposerPlanInteractionView,
};
