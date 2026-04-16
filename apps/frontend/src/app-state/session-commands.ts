import type { ProviderId, SessionConfigOption } from "./models";
import type { NewSessionMutationArg, OpenSessionMutationArg } from "./api";
import type {
  useNewSessionMutation,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useSetSessionConfigOptionMutation,
} from "./api-hooks";
import type { ActiveSession } from "./session-selection";
import {
  initialDraftConfigSyncState,
  syncDraftConfigAfterPrompt,
} from "./session-commands-draft";
import { logFailure, logInfo } from "./frontend-logger";

const NEW_SESSION_HISTORY_LIMIT = 100;

type NewSessionTrigger = ReturnType<typeof useNewSessionMutation>[0];
type OpenSessionTrigger = ReturnType<typeof useOpenSessionMutation>[0];
type PromptSessionTrigger = ReturnType<typeof usePromptSessionMutation>[0];
type SetSessionConfigOptionTrigger = ReturnType<
  typeof useSetSessionConfigOptionMutation
>[0];

interface OpenSessionRowArgs {
  openSession: OpenSessionTrigger;
  request: OpenSessionMutationArg;
  onSessionSelected?: (() => void) | undefined;
}

interface SubmitPromptArgs {
  activeSession: ActiveSession;
  newSession: NewSessionTrigger;
  openSession: OpenSessionTrigger;
  onDraftPromptCommitted?:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  promptSession: PromptSessionTrigger;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
  setDraft: (draft: string) => void;
  text: string;
}

interface DraftCommittedSession {
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  modes: unknown;
  models: unknown;
  openSessionId: string;
  provider: ProviderId;
  sessionId: string;
}

interface CanSubmitPromptArgs {
  activeSession: ActiveSession | null;
  isLoading: boolean;
  text: string;
  draftProviderReady: boolean;
  openSessionConfigSyncBlocked: boolean;
}

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
  onSessionSelected,
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
    onSessionSelected?.();
  } catch (error) {
    logFailure("frontend.session.open.intent.failed", error, {
      cwd: request.cwd,
      provider: request.provider,
      request_limit: request.limit ?? null,
      session_id: request.sessionId,
      title: request.title,
    });
  }
}

async function promptOpenSession(
  promptSession: PromptSessionTrigger,
  openSessionId: string,
  text: string,
): Promise<void> {
  await promptSession({
    openSessionId,
    prompt: [{ text, type: "text" }],
  }).unwrap();
}

async function submitDraftPrompt({
  activeSession,
  newSession,
  onDraftPromptCommitted,
  openSession,
  promptSession,
  setSessionConfigOption,
  setDraft,
  text,
}: SubmitPromptArgs & {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
}): Promise<void> {
  if (activeSession.provider === null) {
    return;
  }
  const response = await newSession({
    cwd: activeSession.cwd,
    limit: NEW_SESSION_HISTORY_LIMIT,
    provider: activeSession.provider,
  } satisfies NewSessionMutationArg).unwrap();
  await promptOpenSession(promptSession, response.history.openSessionId, text);
  const selectedConfig =
    activeSession.selectedConfigByProvider[activeSession.provider] ?? {};
  const syncState = await syncDraftConfigAfterPrompt({
    activeSession,
    openSession,
    selectedConfig,
    sessionId: response.sessionId,
    setSessionConfigOption,
    state: initialDraftConfigSyncState(
      response.configOptions ?? null,
      response.history.openSessionId,
    ),
  });
  onDraftPromptCommitted?.({
    configOptions: syncState.configOptions,
    configSyncBlocked: syncState.configSyncBlocked,
    configSyncError: syncState.configSyncError,
    modes: response.modes,
    models: response.models,
    openSessionId: syncState.openSessionId,
    provider: activeSession.provider,
    sessionId: response.sessionId,
  });
  setDraft("");
}

async function submitPrompt({
  activeSession,
  newSession,
  onDraftPromptCommitted,
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
        openSession,
        promptSession,
        setSessionConfigOption,
        setDraft,
        text,
      });
      return;
    }
    await promptOpenSession(promptSession, activeSession.openSessionId, text);
    setDraft("");
  } catch {
    // The mutation state renders the failure while preserving the draft.
  }
}

export { canSubmitPrompt, openSessionRow, submitPrompt };
