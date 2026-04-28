import type { SessionConfigOption } from "@conduit/session-client";
import type { OpenSessionMutationArg } from "./api";
import type {
  OpenSessionTrigger,
  SetSessionConfigOptionTrigger,
} from "./session-command-triggers";
import type { ActiveSession } from "./session-selection";
import { logFailure, logInfo } from "./frontend-logger";

const NEW_SESSION_HISTORY_LIMIT = 100;

interface DraftConfigSyncState {
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  openSessionId: string;
  revision: number;
}

function requireDraftProvider(
  activeSession: Extract<ActiveSession, { kind: "draft" }>,
): "claude" | "copilot" | "codex" {
  if (activeSession.provider === null) {
    throw new Error("draft provider missing");
  }
  return activeSession.provider;
}

function initialDraftConfigSyncState(
  configOptions: SessionConfigOption[] | null,
  openSessionId: string,
  revision: number,
): DraftConfigSyncState {
  return {
    configOptions,
    configSyncBlocked: false,
    configSyncError: null,
    openSessionId,
    revision,
  };
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

async function applyDraftConfigEntries(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  entries: [string, string][];
  index: number;
  sessionId: string;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
  latest: SessionConfigOption[] | null;
}): Promise<SessionConfigOption[] | null> {
  if (args.index >= args.entries.length) {
    return args.latest;
  }
  const [configId, value] = args.entries[args.index];
  const provider = requireDraftProvider(args.activeSession);
  const applied = await args
    .setSessionConfigOption({
      configId,
      provider,
      sessionId: args.sessionId,
      value,
    })
    .unwrap();
  return applyDraftConfigEntries({
    activeSession: args.activeSession,
    entries: args.entries,
    index: args.index + 1,
    latest: applied.configOptions,
    sessionId: args.sessionId,
    setSessionConfigOption: args.setSessionConfigOption,
  });
}

async function reopenDraftSession(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  openSession: OpenSessionTrigger;
  sessionId: string;
}): Promise<{
  configOptions: SessionConfigOption[] | null;
  openSessionId: string;
  revision: number;
}> {
  const provider = requireDraftProvider(args.activeSession);
  logInfo("frontend.session.draft_sync.reopen.start", {
    provider,
    request_cwd: args.activeSession.cwd,
    session_id: args.sessionId,
  });
  const reopened = await args
    .openSession({
      cwd: args.activeSession.cwd,
      limit: NEW_SESSION_HISTORY_LIMIT,
      provider,
      sessionId: args.sessionId,
      title: null,
    } satisfies OpenSessionMutationArg)
    .unwrap();
  logInfo("frontend.session.draft_sync.reopen.finish", {
    open_session_id: reopened.openSessionId,
    provider,
    session_id: reopened.sessionId,
  });
  return {
    configOptions: reopened.configOptions ?? null,
    openSessionId: reopened.openSessionId,
    revision: reopened.revision,
  };
}

function syncErrorState(
  state: DraftConfigSyncState,
  error: unknown,
): DraftConfigSyncState {
  return {
    configOptions: state.configOptions,
    configSyncBlocked: true,
    configSyncError: queryErrorMessage(error),
    openSessionId: state.openSessionId,
    revision: state.revision,
  };
}

async function syncDraftConfigAfterPrompt(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  openSession: OpenSessionTrigger;
  selectedConfig: Record<string, string>;
  sessionId: string;
  setSessionConfigOption: SetSessionConfigOptionTrigger;
  state: DraftConfigSyncState;
}): Promise<DraftConfigSyncState> {
  const entries = Object.entries(args.selectedConfig);
  if (entries.length === 0) {
    return args.state;
  }
  try {
    const reopened = await reopenDraftSession(args);
    const configOptions = await applyDraftConfigEntries({
      activeSession: args.activeSession,
      entries,
      index: 0,
      latest: reopened.configOptions,
      sessionId: args.sessionId,
      setSessionConfigOption: args.setSessionConfigOption,
    });
    return {
      configOptions,
      configSyncBlocked: false,
      configSyncError: null,
      openSessionId: reopened.openSessionId,
      revision: reopened.revision,
    };
  } catch (error) {
    logFailure("frontend.session.draft_sync.failed", error, {
      config_entry_count: entries.length,
      provider: args.activeSession.provider,
      request_cwd: args.activeSession.cwd,
      session_id: args.sessionId,
    });
    return syncErrorState(args.state, error);
  }
}

export { initialDraftConfigSyncState, syncDraftConfigAfterPrompt };
