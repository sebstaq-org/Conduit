import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  SessionHistoryWindow,
  SessionGroupsQuery,
  SessionGroupsView,
  TranscriptItem,
} from "@conduit/session-client";
import {
  addProjectQuery,
  getProjectSuggestionsQuery,
  getRuntimeHealthQuery,
  getSessionGroupsQuery,
  listProjectsQuery,
  openSessionQuery,
  promptSessionQuery,
  readSessionHistoryQuery,
  removeProjectQuery,
  sessionClient,
  updateProjectQuery,
} from "./session-api-queries";
import { applyTimelineItems } from "./session-history-cache";
import { subscribeSessionIndexInvalidation } from "./session-index-subscription";
import { activeSessionOpened } from "./session-selection";
import type {
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  RuntimeHealthView,
} from "./session-api-queries";

interface OpenSessionLifecycleApi {
  dispatch: (action: unknown) => unknown;
  queryFulfilled: Promise<{ data: SessionHistoryWindow }>;
}

interface CacheLifecycleApi {
  cacheDataLoaded: Promise<unknown>;
  cacheEntryRemoved: Promise<unknown>;
  dispatch: (action: unknown) => unknown;
}

type DispatchLike = (action: unknown) => unknown;
type UpsertSessionHistory = (
  dispatch: DispatchLike,
  history: SessionHistoryWindow,
) => void;
type InvalidateSessionHistory = (
  dispatch: DispatchLike,
  openSessionId: string,
) => void;
interface TimelineItemsUpdate {
  openSessionId: string;
  revision: number;
  items: TranscriptItem[];
}

type UpdateSessionHistoryItems = (
  dispatch: DispatchLike,
  update: TimelineItemsUpdate,
) => void;
type InvalidateSessionGroups = (dispatch: DispatchLike) => void;
type ProjectSuggestionsQueryArg = ProjectSuggestionsQuery | undefined;
type ProjectUpdateArg = ProjectUpdateRequest;

const projectMutationInvalidations = [
  { id: "LIST", type: "Projects" },
  { id: "SUGGESTIONS", type: "Projects" },
  { id: "LIST", type: "SessionGroups" },
] as const;
const projectListEndpoint = {
  providesTags: [{ id: "LIST", type: "Projects" }],
  queryFn: listProjectsQuery,
} as const;
const projectSuggestionsEndpoint = {
  providesTags: [{ id: "SUGGESTIONS", type: "Projects" }],
  queryFn: getProjectSuggestionsQuery,
} as const;
const projectUpdateEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: updateProjectQuery,
} as const;

let upsertSessionHistory: UpsertSessionHistory = (): void => {
  throw new Error("session history cache upsert is not initialized");
};
let invalidateSessionHistory: InvalidateSessionHistory = (): void => {
  throw new Error("session history invalidation is not initialized");
};
let updateSessionHistoryItems: UpdateSessionHistoryItems = (): void => {
  throw new Error("session history cache item update is not initialized");
};
let invalidateSessionGroups: InvalidateSessionGroups = (): void => {
  throw new Error("session groups invalidation is not initialized");
};

async function handleOpenSessionStarted(
  { cwd, provider, sessionId, title }: OpenSessionMutationArg,
  { dispatch, queryFulfilled }: OpenSessionLifecycleApi,
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    dispatch(
      activeSessionOpened({
        cwd,
        openSessionId: data.openSessionId,
        provider,
        sessionId,
        title,
      }),
    );
    upsertSessionHistory(dispatch, data);
  } catch {
    // The query result already carries the user-visible failure.
  }
}

async function handleSessionHistoryCacheEntryAdded(
  { openSessionId }: ReadSessionHistoryQueryArg,
  { cacheDataLoaded, cacheEntryRemoved, dispatch }: CacheLifecycleApi,
): Promise<void> {
  let unsubscribe: (() => void) | null = null;
  try {
    await cacheDataLoaded;
    unsubscribe = await sessionClient.subscribeTimelineChanges(
      openSessionId,
      (event) => {
        if (event.openSessionId !== openSessionId) {
          return;
        }
        if (event.items !== undefined) {
          updateSessionHistoryItems(dispatch, {
            items: event.items,
            openSessionId,
            revision: event.revision,
          });
          return;
        }
        invalidateSessionHistory(dispatch, openSessionId);
      },
    );
    await cacheEntryRemoved;
  } finally {
    unsubscribe?.();
  }
}

async function handleSessionGroupsCacheEntryAdded(
  _query: SessionGroupsQuery | undefined,
  { cacheDataLoaded, cacheEntryRemoved, dispatch }: CacheLifecycleApi,
): Promise<void> {
  let unsubscribes: (() => void)[] = [];
  try {
    await cacheDataLoaded;
    unsubscribes = await subscribeSessionIndexInvalidation(
      sessionClient,
      dispatch,
      invalidateSessionGroups,
    );
    await cacheEntryRemoved;
  } finally {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  }
}

const runtimeHealthEndpoint = {
  providesTags: [{ id: "CURRENT", type: "RuntimeHealth" }],
  queryFn: getRuntimeHealthQuery,
} as const;
const sessionGroupsEndpoint = {
  onCacheEntryAdded: handleSessionGroupsCacheEntryAdded,
  providesTags: [{ id: "LIST", type: "SessionGroups" }],
  queryFn: getSessionGroupsQuery,
} as const;
const openSessionEndpoint = {
  onQueryStarted: handleOpenSessionStarted,
  queryFn: openSessionQuery,
} as const;
const promptSessionEndpoint = {
  invalidatesTags: (
    _result: unknown,
    _error: unknown,
    args: PromptSessionMutationArg,
  ) => [{ id: args.openSessionId, type: "SessionHistory" as const }],
  queryFn: promptSessionQuery,
} as const;
const readSessionHistoryEndpoint = {
  onCacheEntryAdded: handleSessionHistoryCacheEntryAdded,
  providesTags: (
    _result: unknown,
    _error: unknown,
    args: ReadSessionHistoryQueryArg,
  ) => [{ id: args.openSessionId, type: "SessionHistory" as const }],
  queryFn: readSessionHistoryQuery,
} as const;

const conduitApi = createApi({
  reducerPath: "conduitApi",
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ["Projects", "RuntimeHealth", "SessionGroups", "SessionHistory"],
  endpoints: (builder) => ({
    listProjects: builder.query<ProjectListView, undefined>(
      projectListEndpoint,
    ),
    addProject: builder.mutation<ProjectListView, ProjectAddRequest>({
      invalidatesTags: projectMutationInvalidations,
      queryFn: addProjectQuery,
    }),
    removeProject: builder.mutation<ProjectListView, ProjectRemoveRequest>({
      invalidatesTags: projectMutationInvalidations,
      queryFn: removeProjectQuery,
    }),
    updateProject: builder.mutation<ProjectListView, ProjectUpdateArg>(
      projectUpdateEndpoint,
    ),
    getProjectSuggestions: builder.query<
      ProjectSuggestionsView,
      ProjectSuggestionsQueryArg
    >(projectSuggestionsEndpoint),
    getRuntimeHealth: builder.query<RuntimeHealthView, undefined>(
      runtimeHealthEndpoint,
    ),
    getSessionGroups: builder.query<
      SessionGroupsView,
      SessionGroupsQuery | undefined
    >(sessionGroupsEndpoint),
    openSession: builder.mutation<SessionHistoryWindow, OpenSessionMutationArg>(
      openSessionEndpoint,
    ),
    promptSession: builder.mutation<null, PromptSessionMutationArg>(
      promptSessionEndpoint,
    ),
    readSessionHistory: builder.query<
      SessionHistoryWindow,
      ReadSessionHistoryQueryArg
    >(readSessionHistoryEndpoint),
  }),
});

upsertSessionHistory = (dispatch, history): void => {
  void dispatch(
    conduitApi.util.upsertQueryData(
      "readSessionHistory",
      { openSessionId: history.openSessionId },
      history,
    ),
  );
};

invalidateSessionHistory = (dispatch, openSessionId): void => {
  void dispatch(
    conduitApi.util.invalidateTags([
      { id: openSessionId, type: "SessionHistory" },
    ]),
  );
};

updateSessionHistoryItems = (dispatch, update): void => {
  void dispatch(
    conduitApi.util.updateQueryData(
      "readSessionHistory",
      { openSessionId: update.openSessionId },
      (history) => applyTimelineItems(history, update.revision, update.items),
    ),
  );
};

invalidateSessionGroups = (dispatch): void => {
  void dispatch(
    conduitApi.util.invalidateTags([{ id: "LIST", type: "SessionGroups" }]),
  );
};

export { conduitApi };
export type {
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
};
