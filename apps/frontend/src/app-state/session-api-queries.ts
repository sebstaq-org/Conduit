import type {
  ContentBlock,
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProviderId,
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
} from "@conduit/session-client";
import { sessionClient } from "./session-client";

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

type QueryResult<ResponseData> = Promise<
  { data: ResponseData } | { error: string }
>;

function toQueryError(error: unknown): string {
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
    return { error: toQueryError(error) };
  }
}

async function getSettingsQuery(): QueryResult<GlobalSettingsView> {
  try {
    const data = await sessionClient.getSettings();
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function updateSettingsQuery(
  request: GlobalSettingsUpdateRequest,
): QueryResult<GlobalSettingsView> {
  try {
    const data = await sessionClient.updateSettings(request);
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function listProjectsQuery(): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.listProjects();
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function addProjectQuery(
  request: ProjectAddRequest,
): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.addProject(request);
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function removeProjectQuery(
  request: ProjectRemoveRequest,
): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.removeProject(request);
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function updateProjectQuery(
  request: ProjectUpdateRequest,
): QueryResult<ProjectListView> {
  try {
    const data = await sessionClient.updateProject(request);
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function getProjectSuggestionsQuery(
  query: ProjectSuggestionsQuery | undefined,
): QueryResult<ProjectSuggestionsView> {
  try {
    const data = await sessionClient.getProjectSuggestions(query);
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function newSessionQuery({
  cwd,
  limit,
  provider,
}: NewSessionMutationArg): QueryResult<SessionNewResult> {
  try {
    const response = await sessionClient.newSession(provider, {
      cwd,
      limit,
    });
    if (!response.ok) {
      return { error: response.error?.message ?? "session new failed" };
    }
    if (response.result === null) {
      return { error: "session new returned no session" };
    }
    return { data: response.result };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function openSessionQuery({
  cwd,
  limit,
  provider,
  sessionId,
}: OpenSessionMutationArg): QueryResult<SessionHistoryWindow> {
  try {
    const response = await sessionClient.openSession(provider, {
      cwd,
      limit,
      sessionId,
    });
    if (!response.ok) {
      return { error: response.error?.message ?? "session open failed" };
    }
    if (response.result === null) {
      return { error: "session open returned no history" };
    }
    return { data: response.result };
  } catch (error) {
    return { error: toQueryError(error) };
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
    return { error: toQueryError(error) };
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
    return { error: toQueryError(error) };
  }
}

export {
  addProjectQuery,
  getProjectSuggestionsQuery,
  getSettingsQuery,
  getSessionGroupsQuery,
  listProjectsQuery,
  newSessionQuery,
  openSessionQuery,
  promptSessionQuery,
  readSessionHistoryQuery,
  removeProjectQuery,
  sessionClient,
  updateProjectQuery,
  updateSettingsQuery,
};
export type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
};
export type { RuntimeHealthView } from "./api-runtime-health-query";
