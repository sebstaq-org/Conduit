import type {
  ContentBlock,
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProviderId,
  ProvidersConfigSnapshotResult,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  SessionSetConfigOptionResult,
} from "@conduit/session-client";
import { sessionClient } from "./session-client";
import {
  logDebug,
  logFailure,
  logInfo,
  logWarn,
} from "./frontend-logger";

interface OpenSessionMutationArg {
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
  limit?: number;
}

interface NewSessionMutationArg {
  provider: ProviderId;
  cwd: string;
  limit?: number;
}

interface ReadSessionHistoryQueryArg {
  openSessionId: string;
  cursor?: string | null;
  limit?: number;
}

interface PromptSessionMutationArg {
  openSessionId: string;
  prompt: ContentBlock[];
}

interface SetSessionConfigOptionMutationArg {
  provider: ProviderId;
  sessionId: string;
  configId: string;
  value: string;
}

type QueryResult<ResponseData> = Promise<
  { data: ResponseData } | { error: string }
>;

interface QueryErrorContext extends Record<string, unknown> {
  query_name: string;
  query_args?: Record<string, unknown>;
}

function toQueryError(error: unknown, context: QueryErrorContext): string {
  logFailure("frontend.api.query.exception", error, context);
  if (error instanceof Error) {
    return error.message;
  }
  return "session request failed";
}

async function getSessionGroupsQuery(
  query: SessionGroupsQuery | undefined,
): QueryResult<SessionGroupsView> {
  try {
    const data = await sessionClient.getSessionGroups(query);
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { query: query ?? null },
        query_name: "getSessionGroupsQuery",
      }),
    };
  }
}

async function getProvidersConfigSnapshotQuery(): QueryResult<ProvidersConfigSnapshotResult> {
  try {
    const data = await sessionClient.getProvidersConfigSnapshot();
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_name: "getProvidersConfigSnapshotQuery",
      }),
    };
  }
}

async function getSettingsQuery(): QueryResult<GlobalSettingsView> {
  try {
    const data = await sessionClient.getSettings();
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_name: "getSettingsQuery",
      }),
    };
  }
}

async function updateSettingsQuery(
  request: GlobalSettingsUpdateRequest,
): QueryResult<GlobalSettingsView> {
  try {
    const data = await sessionClient.updateSettings(request);
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: request,
        query_name: "updateSettingsQuery",
      }),
    };
  }
}

async function listProjectsQuery(): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.listProjects();
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_name: "listProjectsQuery",
      }),
    };
  }
}

async function addProjectQuery(
  request: ProjectAddRequest,
): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.addProject(request);
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: request,
        query_name: "addProjectQuery",
      }),
    };
  }
}

async function removeProjectQuery(
  request: ProjectRemoveRequest,
): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.removeProject(request);
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: request,
        query_name: "removeProjectQuery",
      }),
    };
  }
}

async function updateProjectQuery(
  request: ProjectUpdateRequest,
): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.updateProject(request);
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: request,
        query_name: "updateProjectQuery",
      }),
    };
  }
}

async function getProjectSuggestionsQuery(
  query: ProjectSuggestionsQuery | undefined,
): QueryResult<ProjectSuggestionsView> {
  try {
    const data = await sessionClient.getProjectSuggestions(query);
    return { data };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { query: query ?? null },
        query_name: "getProjectSuggestionsQuery",
      }),
    };
  }
}

async function newSessionQuery({
  cwd,
  limit,
  provider,
}: NewSessionMutationArg): QueryResult<SessionNewResult> {
  logDebug("frontend.session.new.query.start", {
    cwd,
    limit,
    provider,
  });
  try {
    const response = await sessionClient.newSession(provider, {
      cwd,
      limit,
    });
    logInfo("frontend.session.new.query.transport", {
      cwd,
      provider,
      response_error_code: response.error?.code ?? null,
      response_error_message: response.error?.message ?? null,
      response_id: response.id,
      response_ok: response.ok,
      response_result_present: response.result !== null,
    });
    if (!response.ok) {
      logWarn("frontend.session.new.query.rejected", {
        cwd,
        provider,
        rejection_code: "response_not_ok",
        rejection_message: response.error?.message ?? "session new failed",
      });
      return { error: response.error?.message ?? "session new failed" };
    }
    if (response.result === null) {
      logWarn("frontend.session.new.query.rejected", {
        cwd,
        provider,
        rejection_code: "response_result_missing",
      });
      return { error: "session new returned no session" };
    }
    logInfo("frontend.session.new.query.success", {
      cwd,
      open_session_id: response.result.history.openSessionId,
      provider,
      session_id: response.result.sessionId,
    });
    return { data: response.result };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { cwd, limit, provider },
        query_name: "newSessionQuery",
      }),
    };
  }
}

async function openSessionQuery({
  cwd,
  limit,
  provider,
  sessionId,
}: OpenSessionMutationArg): QueryResult<SessionOpenResult> {
  const queryArgs = { cwd, limit, provider, session_id: sessionId };
  logDebug("frontend.session.open.query.start", queryArgs);
  try {
    const response = await sessionClient.openSession(provider, {
      cwd,
      limit,
      sessionId,
    });
    logInfo("frontend.session.open.query.transport", {
      ...queryArgs,
      response_error_code: response.error?.code ?? null,
      response_error_message: response.error?.message ?? null,
      response_id: response.id,
      response_ok: response.ok,
      response_result_present: response.result !== null,
    });
    if (!response.ok) {
      const message = response.error?.message ?? "session open failed";
      logWarn("frontend.session.open.query.rejected", {
        ...queryArgs,
        rejection_code: "response_not_ok",
        rejection_message: message,
      });
      return { error: message };
    }
    if (response.result === null) {
      logWarn("frontend.session.open.query.rejected", {
        ...queryArgs,
        rejection_code: "response_result_missing",
      });
      return { error: "session open returned no history" };
    }
    logInfo("frontend.session.open.query.success", {
      ...queryArgs,
      open_session_id: response.result.openSessionId,
      response_revision: response.result.revision,
      result_session_id: response.result.sessionId,
    });
    return { data: response.result };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: queryArgs,
        query_name: "openSessionQuery",
      }),
    };
  }
}

async function readSessionHistoryQuery({
  cursor,
  limit,
  openSessionId,
}: ReadSessionHistoryQueryArg): QueryResult<SessionHistoryWindow> {
  try {
    const response = await sessionClient.readSessionHistory({
      cursor,
      limit,
      openSessionId,
    });
    if (!response.ok) {
      return { error: response.error?.message ?? "session history failed" };
    }
    if (response.result === null) {
      return { error: "session history returned no window" };
    }
    return { data: response.result };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { cursor: cursor ?? null, limit, openSessionId },
        query_name: "readSessionHistoryQuery",
      }),
    };
  }
}

async function promptSessionQuery({
  openSessionId,
  prompt,
}: PromptSessionMutationArg): QueryResult<null> {
  try {
    await sessionClient.promptSession({ openSessionId, prompt });
    return { data: null };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { openSessionId },
        query_name: "promptSessionQuery",
      }),
    };
  }
}

async function setSessionConfigOptionQuery({
  provider,
  sessionId,
  configId,
  value,
}: SetSessionConfigOptionMutationArg): QueryResult<SessionSetConfigOptionResult> {
  try {
    const response = await sessionClient.setSessionConfigOption(provider, {
      sessionId,
      configId,
      value,
    });
    if (!response.ok) {
      return {
        error: response.error?.message ?? "session set_config_option failed",
      };
    }
    if (response.result === null) {
      return { error: "session set_config_option returned no result" };
    }
    return { data: response.result };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { configId, provider, sessionId, value },
        query_name: "setSessionConfigOptionQuery",
      }),
    };
  }
}

export {
  addProjectQuery,
  getProvidersConfigSnapshotQuery,
  getProjectSuggestionsQuery,
  getSettingsQuery,
  getSessionGroupsQuery,
  listProjectsQuery,
  newSessionQuery,
  openSessionQuery,
  promptSessionQuery,
  readSessionHistoryQuery,
  removeProjectQuery,
  setSessionConfigOptionQuery,
  sessionClient,
  updateProjectQuery,
  updateSettingsQuery,
};
export type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  SetSessionConfigOptionMutationArg,
};
export type { RuntimeHealthView } from "./api-runtime-health-query";
