import { promptTrackedOpenSession } from "./session-prompt-turn-command";
import type { PromptSessionTrigger } from "./session-prompt-turn-command";
import {
  sessionPromptTurnFinished,
  sessionPromptTurnStarted,
} from "./session-prompt-turns";
import type { ActiveSession } from "./session-selection";

type PromptTurnAction =
  | ReturnType<typeof sessionPromptTurnFinished>
  | ReturnType<typeof sessionPromptTurnStarted>;
type PromptTurnDispatch = (action: PromptTurnAction) => unknown;

interface PromptLivePlanInteractionSessionArgs {
  activeSession: ActiveSession | null;
  dispatch: PromptTurnDispatch;
  enabled: boolean;
  openSessionId: string | null;
  promptSession: PromptSessionTrigger;
  text: string;
}

async function promptLivePlanInteractionSession({
  activeSession,
  dispatch,
  enabled,
  openSessionId,
  promptSession,
  text,
}: PromptLivePlanInteractionSessionArgs): Promise<void> {
  if (!enabled || activeSession?.kind !== "open" || openSessionId === null) {
    return;
  }
  await promptTrackedOpenSession({
    identity: {
      provider: activeSession.provider,
      sessionId: activeSession.sessionId,
    },
    onPromptTurnFinished: (identity) => {
      dispatch(sessionPromptTurnFinished(identity));
    },
    onPromptTurnStarted: (identity) => {
      dispatch(sessionPromptTurnStarted(identity));
    },
    openSessionId,
    promptSession,
    text,
  });
}

export { promptLivePlanInteractionSession };
export type { PromptLivePlanInteractionSessionArgs, PromptTurnDispatch };
