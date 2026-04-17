import {
  activeSessionOpened,
  conduitApi,
  sessionPromptTurnFinished,
  sessionPromptTurnStarted,
  submitPrompt,
} from "@/app-state";
import type {
  ActiveSession,
  AppDispatch,
  useNewSessionMutation,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useSetSessionConfigOptionMutation,
} from "@/app-state";
import { showPromptFailureToast } from "@/features/session-notifications";

interface CreateSessionComposerSendHandlerArgs {
  activeSession: ActiveSession | null;
  canSend: boolean;
  dispatch: AppDispatch;
  newSession: ReturnType<typeof useNewSessionMutation>[0];
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  promptSession: ReturnType<typeof usePromptSessionMutation>[0];
  setDraft: (draft: string) => void;
  setSessionConfigOption: ReturnType<
    typeof useSetSessionConfigOptionMutation
  >[0];
  text: string;
}

function createDraftCommitCallback(args: {
  activeSession: ActiveSession;
  dispatch: AppDispatch;
}): Parameters<typeof submitPrompt>[0]["onDraftPromptCommitted"] {
  return (session): void => {
    args.dispatch(
      activeSessionOpened({
        configOptions: session.configOptions,
        configSyncBlocked: session.configSyncBlocked,
        configSyncError: session.configSyncError,
        cwd: args.activeSession.cwd,
        kind: "open",
        modes: session.modes,
        models: session.models,
        openSessionId: session.openSessionId,
        provider: session.provider,
        sessionId: session.sessionId,
        title: null,
      }),
    );
    void args.dispatch(
      conduitApi.util.invalidateTags([{ id: "LIST", type: "SessionGroups" }]),
    );
  };
}

function createSessionComposerSendHandler({
  activeSession,
  canSend,
  dispatch,
  newSession,
  openSession,
  promptSession,
  setDraft,
  setSessionConfigOption,
  text,
}: CreateSessionComposerSendHandlerArgs): () => void {
  return (): void => {
    if (!canSend || activeSession === null) {
      return;
    }
    void submitPrompt({
      activeSession,
      newSession,
      openSession,
      onDraftPromptCommitted: createDraftCommitCallback({
        activeSession,
        dispatch,
      }),
      onPromptTurnFinished: (identity) =>
        dispatch(sessionPromptTurnFinished(identity)),
      onPromptTurnStarted: (identity) =>
        dispatch(sessionPromptTurnStarted(identity)),
      onFailure: showPromptFailureToast,
      promptSession,
      setDraft,
      setSessionConfigOption,
      text,
    });
  };
}

export { createSessionComposerSendHandler };
