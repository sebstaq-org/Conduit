import type {
  ProviderId,
  SessionConfigOption,
  SessionNewResult,
} from "@conduit/session-client";
import type { NewSessionMutationArg } from "./api";
import type { SessionPromptTurnIdentity } from "./session-prompt-turns";
import { promptTrackedOpenSession } from "./session-prompt-turn-command";
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

interface DraftConfigSyncState {
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  openSessionId: string;
}

interface SubmitDraftPromptArgs {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  newSession: NewSessionTrigger;
  onDraftPromptCommitted?:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  onPromptTurnFinished?:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  onPromptTurnStarted?:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  openSession: OpenSessionTrigger;
  promptSession: PromptSessionTrigger;
  setDraft: (draft: string) => void;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
  text: string;
}

function committedDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  response: SessionNewResult;
  syncState: DraftConfigSyncState;
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
  syncState: DraftConfigSyncState;
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

async function promptOpenDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  onDraftPromptCommitted:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  onPromptTurnFinished:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  onPromptTurnStarted:
    | ((identity: SessionPromptTurnIdentity) => void)
    | undefined;
  promptSession: PromptSessionTrigger;
  provider: ProviderId;
  response: SessionNewResult;
  setDraft: (draft: string) => void;
  syncState: DraftConfigSyncState;
  text: string;
}): Promise<void> {
  await promptTrackedOpenSession({
    identity: { provider: args.provider, sessionId: args.response.sessionId },
    onPromptTurnFinished: args.onPromptTurnFinished,
    onPromptTurnStarted: args.onPromptTurnStarted,
    openSessionId: args.syncState.openSessionId,
    promptSession: args.promptSession,
    text: args.text,
  });
  args.onDraftPromptCommitted?.(
    committedDraftSession({
      activeSession: args.activeSession,
      response: args.response,
      syncState: args.syncState,
    }),
  );
  args.setDraft("");
}

async function createDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  newSession: NewSessionTrigger;
  provider: ProviderId;
}): Promise<SessionNewResult> {
  const response = await args
    .newSession({
      cwd: args.activeSession.cwd,
      limit: NEW_SESSION_HISTORY_LIMIT,
      provider: args.provider,
    } satisfies NewSessionMutationArg)
    .unwrap();
  return response;
}

async function syncCreatedDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  openSession: OpenSessionTrigger;
  response: SessionNewResult;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
}): Promise<DraftConfigSyncState> {
  const syncState = await syncDraftConfigAfterPrompt({
    activeSession: args.activeSession,
    openSession: args.openSession,
    selectedConfig: draftSelectedConfig(args.activeSession),
    sessionId: args.response.sessionId,
    setSessionConfigOption: args.setSessionConfigOption,
    state: initialDraftConfigSyncState(
      args.response.configOptions ?? null,
      args.response.history.openSessionId,
    ),
  });
  return syncState;
}

async function submitDraftPrompt({
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
}: SubmitDraftPromptArgs): Promise<void> {
  const provider = activeSession.provider;
  if (provider === null) {
    return;
  }
  const response = await createDraftSession({
    activeSession,
    newSession,
    provider,
  });
  const syncState = await syncCreatedDraftSession({
    activeSession,
    openSession,
    response,
    setSessionConfigOption,
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
  await promptOpenDraftSession({
    activeSession,
    onDraftPromptCommitted,
    onPromptTurnFinished,
    onPromptTurnStarted,
    promptSession,
    provider,
    response,
    setDraft,
    syncState,
    text,
  });
}

export { submitDraftPrompt };
export type { DraftCommittedSession };
