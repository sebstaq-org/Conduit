import type {
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProvidersConfigSnapshotResult,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionSetConfigOptionResult,
} from "@conduit/session-client";
import { toQueryError } from "./session-api-query-utils";
import type { QueryResult } from "./session-api-query-utils";
import {
  newSessionQuery,
  openSessionQuery,
  promptSessionQuery,
  readSessionHistoryQuery,
} from "./session-api-session-queries";
import { sessionClient } from "./session-client";
import type { SetSessionConfigOptionMutationArg } from "./session-api-session-query-types";

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
} from "./session-api-session-query-types";

export type { RuntimeHealthView } from "./api-runtime-health-query";
