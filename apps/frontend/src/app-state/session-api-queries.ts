import type {
  GlobalSettingsUpdateRequest,
  ProjectAddRequest,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectUpdateRequest,
  SessionGroupsQuery,
} from "@conduit/app-protocol";
import type {
  GlobalSettingsView,
  ProjectListView,
  ProjectSuggestionsView,
  ProvidersConfigSnapshotResult,
  SessionGroupsView,
  SessionSetConfigOptionResult,
} from "./models";
import {
  mapGlobalSettingsView,
  mapProjectListView,
  mapProjectSuggestionsView,
  mapProvidersConfigSnapshotResult,
  mapSessionGroupsView,
  mapSessionSetConfigOptionResult,
} from "./protocol-adapters";
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
    return {
      data: mapSessionGroupsView(await sessionClient.getSessionGroups(query)),
    };
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
    return {
      data: mapProvidersConfigSnapshotResult(
        await sessionClient.getProvidersConfigSnapshot(),
      ),
    };
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
    return { data: mapGlobalSettingsView(await sessionClient.getSettings()) };
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
    return {
      data: mapGlobalSettingsView(await sessionClient.updateSettings(request)),
    };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { request },
        query_name: "updateSettingsQuery",
      }),
    };
  }
}

async function listProjectsQuery(): QueryResult<ProjectListView> {
  try {
    return { data: mapProjectListView(await sessionClient.listProjects()) };
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
    return {
      data: mapProjectListView(await sessionClient.addProject(request)),
    };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { request },
        query_name: "addProjectQuery",
      }),
    };
  }
}

async function removeProjectQuery(
  request: ProjectRemoveRequest,
): QueryResult<ProjectListView> {
  try {
    return {
      data: mapProjectListView(await sessionClient.removeProject(request)),
    };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { request },
        query_name: "removeProjectQuery",
      }),
    };
  }
}

async function updateProjectQuery(
  request: ProjectUpdateRequest,
): QueryResult<ProjectListView> {
  try {
    return {
      data: mapProjectListView(await sessionClient.updateProject(request)),
    };
  } catch (error) {
    return {
      error: toQueryError(error, {
        query_args: { request },
        query_name: "updateProjectQuery",
      }),
    };
  }
}

async function getProjectSuggestionsQuery(
  query: ProjectSuggestionsQuery | undefined,
): QueryResult<ProjectSuggestionsView> {
  try {
    return {
      data: mapProjectSuggestionsView(
        await sessionClient.getProjectSuggestions(query),
      ),
    };
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
    return {
      data: mapSessionSetConfigOptionResult(
        await sessionClient.setSessionConfigOption(provider, {
          sessionId,
          configId,
          value,
        }),
      ),
    };
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
