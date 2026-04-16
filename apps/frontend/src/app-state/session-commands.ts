import type {
  ProviderId,
  SessionConfigOption,
  SessionNewResult,
} from "@conduit/session-client";
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

function committedDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  response: SessionNewResult;
  syncState: {
    configOptions: SessionConfigOption[] | null;
    configSyncBlocked: boolean;
    configSyncError: string | null;
    openSessionId: string;
  };
}): DraftCommittedSession {
  if (args.activeSession.provider === null) {
    throw new Error("draft provider missing");
  }
  return {
    configOptions: args.syncState.configOptions,
    configSyncBlocked: args.syncState.configSyncBlocked,
    configSyncError: args.syncState.configSyncError,
    modes: args.response.modes,
    models: args.response.models,
    openSessionId: args.syncState.openSessionId,
    provider: args.activeSession.provider,
    sessionId: args.response.sessionId,
  };
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
    onSessionSelected?.();
  } catch {
    // The mutation state renders the failure row.
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

async function createDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  newSession: NewSessionTrigger;
}): Promise<SessionNewResult | null> {
  if (args.activeSession.provider === null) {
    return null;
  }
  const response = await args
    .newSession({
      cwd: args.activeSession.cwd,
      limit: NEW_SESSION_HISTORY_LIMIT,
      provider: args.activeSession.provider,
    } satisfies NewSessionMutationArg)
    .unwrap();
  return response;
}

function draftSelectedConfig(
  activeSession: Extract<ActiveSession, { kind: "draft" }>,
): Record<string, string> {
  if (activeSession.provider === null) {
    return {};
  }
  return activeSession.selectedConfigByProvider[activeSession.provider] ?? {};
}

function commitDraftIfConfigBlocked(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  onDraftPromptCommitted:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  response: SessionNewResult;
  syncState: {
    configOptions: SessionConfigOption[] | null;
    configSyncBlocked: boolean;
    configSyncError: string | null;
    openSessionId: string;
  };
}): boolean {
  if (!args.syncState.configSyncBlocked) {
    return false;
  }
  args.onDraftPromptCommitted?.(
    committedDraftSession({
      activeSession: args.activeSession,
      response: args.response,
      syncState: args.syncState,
    }),
  );
  return true;
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
  const response = await createDraftSession({ activeSession, newSession });
  if (response === null) {
    return;
  }
  const syncState = await syncDraftConfigAfterPrompt({
    activeSession,
    openSession,
    selectedConfig: draftSelectedConfig(activeSession),
    sessionId: response.sessionId,
    setSessionConfigOption,
    state: initialDraftConfigSyncState(
      response.configOptions ?? null,
      response.history.openSessionId,
    ),
  });
  if (
    commitDraftIfConfigBlocked({
      activeSession,
      onDraftPromptCommitted,
      response,
      syncState,
    })
  ) {
    return;
  }
  await promptOpenSession(promptSession, syncState.openSessionId, text);
  onDraftPromptCommitted?.(
    committedDraftSession({ activeSession, response, syncState }),
  );
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
