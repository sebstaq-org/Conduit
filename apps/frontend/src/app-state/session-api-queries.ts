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
} from "@conduit/session-client";
import { configuredSessionHealthUrl, sessionClient } from "./session-client";

interface OpenSessionMutationArg {
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
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

interface RuntimeHealthView {
  checkedAt: string;
  service: string;
  transport: string;
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

function runtimeHealthErrorMessage(status: number): string {
  return `runtime health failed (${status})`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return true;
}

function readRuntimeString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

function readRuntimeHealthPayload(payload: unknown): RuntimeHealthView | null {
  if (!isObjectRecord(payload)) {
    return null;
  }
  if (payload.ok !== true) {
    return null;
  }
  const service = readRuntimeString(payload.service, "conduit-service");
  const transport = readRuntimeString(payload.transport, "websocket");
  return {
    checkedAt: new Date().toISOString(),
    service,
    transport,
  };
}

function createHealthTimeoutSignal(): {
  abortController: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 2000);
  return { abortController, timeoutId };
}

async function readRuntimeHealthResponse(
  signal: AbortSignal,
): Promise<RuntimeHealthView> {
  const response = await fetch(configuredSessionHealthUrl(), { signal });
  if (!response.ok) {
    throw new Error(runtimeHealthErrorMessage(response.status));
  }
  const payload = readRuntimeHealthPayload(await response.json());
  if (payload === null) {
    throw new Error("runtime health returned invalid payload");
  }
  return payload;
}

async function getRuntimeHealthQuery(): QueryResult<RuntimeHealthView> {
  const timeoutSignal = createHealthTimeoutSignal();
  try {
    const data = await readRuntimeHealthResponse(
      timeoutSignal.abortController.signal,
    );
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  } finally {
    clearTimeout(timeoutSignal.timeoutId);
  }
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
  getRuntimeHealthQuery,
  getProjectSuggestionsQuery,
  getSettingsQuery,
  getSessionGroupsQuery,
  listProjectsQuery,
  openSessionQuery,
  promptSessionQuery,
  readSessionHistoryQuery,
  removeProjectQuery,
  sessionClient,
  updateProjectQuery,
  updateSettingsQuery,
};
export type {
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  RuntimeHealthView,
};
