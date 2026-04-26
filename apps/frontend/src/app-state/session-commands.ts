import type { OpenSessionMutationArg } from "./api";
import type { SessionPromptTurnIdentity } from "./session-prompt-turns";
import { promptTrackedOpenSession } from "./session-prompt-turn-command";
import { submitDraftPrompt } from "./session-commands-draft-submit";
import type { DraftCommittedSession } from "./session-commands-draft-submit";
import type {
  NewSessionTrigger,
  OpenSessionTrigger,
  SetSessionConfigOptionTrigger,
} from "./session-command-triggers";
import type { PromptSessionTrigger } from "./session-prompt-turn-command";
import type { ActiveSession } from "./session-selection";
import { logFailure, logInfo } from "./frontend-logger";

interface OpenSessionRowArgs {
  openSession: OpenSessionTrigger;
  onFailure?: ((failure: OpenSessionFailure) => void) | undefined;
  request: OpenSessionMutationArg;
}

interface SubmitPromptArgs {
  activeSession: ActiveSession;
  newSession: NewSessionTrigger;
  openSession: OpenSessionTrigger;
  onDraftPromptCommitted?:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  onFailure?: ((failure: PromptFailure) => void) | undefined;
  onPromptTurnFinished?:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  onPromptTurnStarted?:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  promptSession: PromptSessionTrigger;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
  setDraft: (draft: string) => void;
  text: string;
}

interface OpenSessionFailure {
  error: unknown;
  request: OpenSessionMutationArg;
}

interface PromptFailure {
  activeSession: ActiveSession;
  error: unknown;
  text: string;
}

interface CanSubmitPromptArgs {
  activeSession: ActiveSession | null;
  isLoading: boolean;
  text: string;
  draftProviderReady: boolean;
  openSessionConfigSyncBlocked: boolean;
}

const openSessionHistoryLimit = 100;

function canSubmitPrompt({
  activeSession,
  isLoading,
  text,
  draftProviderReady,
  openSessionConfigSyncBlocked,
}: CanSubmitPromptArgs): boolean {
  if (activeSession === null || isLoading || text.length === 0) {
    return false;
  }
  if (activeSession.kind === "draft") {
    if (activeSession.provider === null) {
      return false;
    }
    return draftProviderReady;
  }
  return !openSessionConfigSyncBlocked;
}

async function openSessionRow({
  onFailure,
  openSession,
  request,
}: OpenSessionRowArgs): Promise<void> {
  try {
    await openSession(request).unwrap();
    logInfo("frontend.session.open.intent.succeeded", {
      cwd: request.cwd,
      provider: request.provider,
      session_id: request.sessionId,
    });
  } catch (error) {
    logFailure("frontend.session.open.intent.failed", error, {
      cwd: request.cwd,
      provider: request.provider,
      request_limit: request.limit ?? null,
      session_id: request.sessionId,
      title: request.title,
    });
    onFailure?.({ error, request });
  }
}

async function submitPrompt({
  activeSession,
  newSession,
  onDraftPromptCommitted,
  onFailure,
  onPromptTurnFinished,
  onPromptTurnStarted,
  openSession,
  promptSession,
  setSessionConfigOption,
  setDraft,
  text,
}: SubmitPromptArgs): Promise<void> {
  try {
    if (activeSession.kind === "draft") {
      await submitDraftPrompt({
        activeSession,
        newSession,
        onDraftPromptCommitted,
        onPromptTurnFinished,
        onPromptTurnStarted,
        openSession,
        promptSession,
        setSessionConfigOption,
        setDraft,
        text,
      });
      return;
    }
    await promptTrackedOpenSession({
      identity: {
        provider: activeSession.provider,
        sessionId: activeSession.sessionId,
      },
      onPromptTurnFinished,
      onPromptTurnStarted,
      openSessionId: activeSession.openSessionId,
      promptSession,
      text,
    });
    setDraft("");
  } catch (error) {
    // The mutation state renders the failure while preserving the draft.
    onFailure?.({ activeSession, error, text });
  }
}

export {
  canSubmitPrompt,
  openSessionHistoryLimit,
  openSessionRow,
  submitPrompt,
};
export type { OpenSessionFailure, PromptFailure };
