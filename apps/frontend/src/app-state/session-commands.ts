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
  openSessionBase: PromptTimelineBase | null;
  openSession: OpenSessionTrigger;
  onDraftPromptCommitted?:
    | ((session: DraftCommittedSession) => void)
    | undefined;
  onFailure?: ((failure: PromptFailure) => void) | undefined;
  onPromptSubmitted?: ((submitted: PromptSubmitted) => void) | undefined;
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

interface PromptSubmitted {
  baseLastItemId: string | null;
  baseRevision: number;
  openSessionId: string;
  text: string;
}

interface PromptTimelineBase {
  lastItemId: string | null;
  revision: number;
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

async function submitDraftActiveSessionPrompt(
  args: SubmitPromptArgs,
): Promise<void> {
  if (args.activeSession.kind !== "draft") {
    return;
  }
  await submitDraftPrompt({
    activeSession: args.activeSession,
    newSession: args.newSession,
    onDraftPromptCommitted: args.onDraftPromptCommitted,
    onPromptSubmitted: args.onPromptSubmitted,
    onPromptTurnFinished: args.onPromptTurnFinished,
    onPromptTurnStarted: args.onPromptTurnStarted,
    openSession: args.openSession,
    promptSession: args.promptSession,
    setSessionConfigOption: args.setSessionConfigOption,
    setDraft: args.setDraft,
    text: args.text,
  });
}

async function submitOpenActiveSessionPrompt(
  args: SubmitPromptArgs,
): Promise<void> {
  if (args.activeSession.kind !== "open") {
    return;
  }
  args.onPromptSubmitted?.({
    baseLastItemId: args.openSessionBase?.lastItemId ?? null,
    baseRevision: args.openSessionBase?.revision ?? 0,
    openSessionId: args.activeSession.openSessionId,
    text: args.text,
  });
  args.setDraft("");
  await promptTrackedOpenSession({
    identity: {
      provider: args.activeSession.provider,
      sessionId: args.activeSession.sessionId,
    },
    onPromptTurnFinished: args.onPromptTurnFinished,
    onPromptTurnStarted: args.onPromptTurnStarted,
    openSessionId: args.activeSession.openSessionId,
    promptSession: args.promptSession,
    text: args.text,
  });
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

async function submitPrompt(args: SubmitPromptArgs): Promise<void> {
  try {
    if (args.activeSession.kind === "draft") {
      await submitDraftActiveSessionPrompt(args);
      return;
    }
    await submitOpenActiveSessionPrompt(args);
  } catch (error) {
    // The mutation state renders the failure while preserving submitted text in history.
    args.onFailure?.({
      activeSession: args.activeSession,
      error,
      text: args.text,
    });
  }
}

export {
  canSubmitPrompt,
  openSessionHistoryLimit,
  openSessionRow,
  submitPrompt,
};
export type {
  OpenSessionFailure,
  PromptFailure,
  PromptSubmitted,
  PromptTimelineBase,
};
