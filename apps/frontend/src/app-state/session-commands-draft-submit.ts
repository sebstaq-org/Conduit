import type {
  LegacyProviderModels,
  ProviderId,
  SessionConfigOption,
  SessionNewResult,
} from "@conduit/session-client";
import type { NewSessionMutationArg } from "./api";
import type { SessionPromptTurnIdentity } from "./session-prompt-turns";
import { promptTrackedOpenSession } from "./session-prompt-turn-command";
import type {
  NewSessionTrigger,
  OpenSessionTrigger,
  SetSessionConfigOptionTrigger,
} from "./session-command-triggers";
import type { PromptSessionTrigger } from "./session-prompt-turn-command";
import type { ActiveSession } from "./session-selection";
import {
  initialDraftConfigSyncState,
  syncDraftConfigAfterPrompt,
} from "./session-commands-draft";

const NEW_SESSION_HISTORY_LIMIT = 100;

interface DraftCommittedSession {
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  modes: unknown;
  models: LegacyProviderModels | null;
  openSessionId: string;
  provider: ProviderId;
  sessionId: string;
}

interface DraftConfigSyncState {
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  openSessionId: string;
  revision: number;
}

interface SubmitDraftPromptArgs {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  newSession: NewSessionTrigger;
  onDraftPromptCommitted?:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  onPromptSubmitted?:
    | ((submitted: {
        baseRevision: number;
        openSessionId: string;
        text: string;
      }) => void)
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
    models: args.response.models ?? null,
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

function commitDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  onDraftPromptCommitted:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  response: SessionNewResult;
  syncState: DraftConfigSyncState;
}): void {
  args.onDraftPromptCommitted?.(
    committedDraftSession({
      activeSession: args.activeSession,
      response: args.response,
      syncState: args.syncState,
    }),
  );
}

async function promptOpenDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  onDraftPromptCommitted:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  onPromptSubmitted:
    | ((submitted: {
        baseRevision: number;
        openSessionId: string;
        text: string;
      }) => void)
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
  args.onPromptSubmitted?.({
    baseRevision: args.syncState.revision,
    openSessionId: args.syncState.openSessionId,
    text: args.text,
  });
  args.setDraft("");
  await promptTrackedOpenSession({
    identity: { provider: args.provider, sessionId: args.response.sessionId },
    onPromptTurnFinished: args.onPromptTurnFinished,
    onPromptTurnStarted: args.onPromptTurnStarted,
    openSessionId: args.syncState.openSessionId,
    promptSession: args.promptSession,
    text: args.text,
  });
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
      args.response.history.revision,
    ),
  });
  return syncState;
}

async function createAndSyncDraftSession(
  args: SubmitDraftPromptArgs,
  provider: ProviderId,
): Promise<{
  response: SessionNewResult;
  syncState: DraftConfigSyncState;
}> {
  const response = await createDraftSession({
    activeSession: args.activeSession,
    newSession: args.newSession,
    provider,
  });
  const syncState = await syncCreatedDraftSession({
    activeSession: args.activeSession,
    openSession: args.openSession,
    response,
    setSessionConfigOption: args.setSessionConfigOption,
  });
  return { response, syncState };
}

async function submitSyncedDraftPrompt(args: {
  provider: ProviderId;
  request: SubmitDraftPromptArgs;
  response: SessionNewResult;
  syncState: DraftConfigSyncState;
}): Promise<void> {
  await promptOpenDraftSession({
    activeSession: args.request.activeSession,
    onDraftPromptCommitted: args.request.onDraftPromptCommitted,
    onPromptSubmitted: args.request.onPromptSubmitted,
    onPromptTurnFinished: args.request.onPromptTurnFinished,
    onPromptTurnStarted: args.request.onPromptTurnStarted,
    promptSession: args.request.promptSession,
    provider: args.provider,
    response: args.response,
    setDraft: args.request.setDraft,
    syncState: args.syncState,
    text: args.request.text,
  });
}

async function submitDraftPrompt(args: SubmitDraftPromptArgs): Promise<void> {
  const provider = args.activeSession.provider;
  if (provider === null) {
    return;
  }
  const { response, syncState } = await createAndSyncDraftSession(
    args,
    provider,
  );
  commitDraftSession({
    activeSession: args.activeSession,
    onDraftPromptCommitted: args.onDraftPromptCommitted,
    response,
    syncState,
  });
  if (syncState.configSyncBlocked) {
    return;
  }
  await submitSyncedDraftPrompt({
    provider,
    request: args,
    response,
    syncState,
  });
}

export { submitDraftPrompt };
export type { DraftCommittedSession };
