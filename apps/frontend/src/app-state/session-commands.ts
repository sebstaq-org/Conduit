import type { NewSessionMutationArg, OpenSessionMutationArg } from "./api";
import type {
  useNewSessionMutation,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useSetSessionConfigOptionMutation,
} from "./api-hooks";
import type { ActiveSession } from "./session-selection";
import type { ProviderId, SessionConfigOption } from "@conduit/session-client";

const NEW_SESSION_HISTORY_LIMIT = 100;

type NewSessionTrigger = ReturnType<typeof useNewSessionMutation>[0];
type OpenSessionTrigger = ReturnType<typeof useOpenSessionMutation>[0];
type PromptSessionTrigger = ReturnType<typeof usePromptSessionMutation>[0];
type SetSessionConfigOptionTrigger =
  ReturnType<typeof useSetSessionConfigOptionMutation>[0];

interface OpenSessionRowArgs {
  openSession: OpenSessionTrigger;
  request: OpenSessionMutationArg;
  onSessionSelected?: (() => void) | undefined;
}

interface SubmitPromptArgs {
  activeSession: ActiveSession;
  newSession: NewSessionTrigger;
  openSession: OpenSessionTrigger;
  onDraftPromptCommitted?: ((session: DraftCommittedSession) => void) | undefined;
  promptSession: PromptSessionTrigger;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
  setDraft: (draft: string) => void;
  text: string;
}

interface DraftCommittedSession {
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  modes: unknown | null;
  models: unknown | null;
  openSessionId: string;
  provider: ProviderId;
  sessionId: string;
}

function queryErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "string"
  ) {
    return error.data;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Session config sync failed after first prompt.";
}

function canSubmitPrompt(
  activeSession: ActiveSession | null,
  isLoading: boolean,
  text: string,
  draftProviderReady: boolean,
  openSessionConfigSyncBlocked: boolean,
): boolean {
  if (activeSession === null || isLoading || text.length === 0) {
    return false;
  }
  if (activeSession.kind === "draft") {
    if (activeSession.provider === null) {
      return false;
    }
    return draftProviderReady;
  }
  if (openSessionConfigSyncBlocked) {
    return false;
  }
  return true;
}

async function openSessionRow({
  onSessionSelected,
  openSession,
  request,
}: OpenSessionRowArgs): Promise<void> {
  try {
    await openSession(request).unwrap();
    onSessionSelected?.();
  } catch {
    // The mutation state renders the failure row.
  }
}

async function submitPrompt({
  activeSession,
  newSession,
  openSession,
  onDraftPromptCommitted,
  promptSession,
  setSessionConfigOption,
  setDraft,
  text,
}: SubmitPromptArgs): Promise<void> {
  try {
    if (activeSession.kind === "draft") {
      if (activeSession.provider === null) {
        return;
      }
      const response = await newSession({
        cwd: activeSession.cwd,
        limit: NEW_SESSION_HISTORY_LIMIT,
        provider: activeSession.provider,
      } satisfies NewSessionMutationArg).unwrap();

      const selectedConfig =
        activeSession.selectedConfigByProvider[activeSession.provider] ?? {};
      await promptSession({
        openSessionId: response.history.openSessionId,
        prompt: [{ text, type: "text" }],
      }).unwrap();

      let effectiveConfigOptions = response.configOptions ?? null;
      let effectiveOpenSessionId = response.history.openSessionId;
      let configSyncBlocked = false;
      let configSyncError: string | null = null;
      if (Object.keys(selectedConfig).length > 0) {
        try {
          const reopened = await openSession({
            cwd: activeSession.cwd,
            limit: NEW_SESSION_HISTORY_LIMIT,
            provider: activeSession.provider,
            sessionId: response.sessionId,
            title: null,
          } satisfies OpenSessionMutationArg).unwrap();
          effectiveOpenSessionId = reopened.openSessionId;
          effectiveConfigOptions = reopened.configOptions ?? null;
          for (const [configId, value] of Object.entries(selectedConfig)) {
            const applied = await setSessionConfigOption({
              configId,
              provider: activeSession.provider,
              sessionId: response.sessionId,
              value,
            }).unwrap();
            effectiveConfigOptions = applied.configOptions;
          }
        } catch (error) {
          configSyncBlocked = true;
          configSyncError = queryErrorMessage(error);
        }
      }

      onDraftPromptCommitted?.({
        configOptions: effectiveConfigOptions,
        configSyncBlocked,
        configSyncError,
        modes: response.modes ?? null,
        models: response.models ?? null,
        openSessionId: effectiveOpenSessionId,
        provider: activeSession.provider,
        sessionId: response.sessionId,
      });
      setDraft("");
      return;
    }
    await promptSession({
      openSessionId: activeSession.openSessionId,
      prompt: [{ text, type: "text" }],
    }).unwrap();
    setDraft("");
  } catch {
    // The mutation state renders the failure while preserving the draft.
  }
}

export { canSubmitPrompt, openSessionRow, submitPrompt };
