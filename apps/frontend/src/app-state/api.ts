import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
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
import {
  addProjectQuery,
  getProjectSuggestionsQuery,
  getRuntimeHealthQuery,
  getSessionGroupsQuery,
  listProjectsQuery,
  openSessionQuery,
  promptSessionQuery,
  removeProjectQuery,
  updateProjectQuery,
} from "./session-api-queries";
import {
  createSessionTimelineHandlers,
  createUninitializedSessionTimelineMutations,
} from "./api-session-timeline-handlers";
import {
  applyTimelineItems,
  beginOlderPageLoad,
  createSessionTimelineData,
  failOlderPageLoad,
  mergeOlderPage,
} from "./session-timeline-cache";
import type {
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  RuntimeHealthView,
} from "./session-api-queries";
import type {
  LoadOlderSessionTimelineArg,
  SessionTimelineMutations,
} from "./api-session-timeline-handlers";
import type { SessionTimelineData } from "./session-timeline-cache";

type DispatchLike = (action: unknown) => unknown;
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
const projectAddEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: addProjectQuery,
} as const;
const projectRemoveEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: removeProjectQuery,
} as const;
const projectUpdateEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: updateProjectQuery,
} as const;
const projectSuggestionsEndpoint = {
  providesTags: [{ id: "SUGGESTIONS", type: "Projects" }],
  queryFn: getProjectSuggestionsQuery,
} as const;

const sessionTimelineMutations: SessionTimelineMutations =
  createUninitializedSessionTimelineMutations();
const sessionTimelineHandlers = createSessionTimelineHandlers(
  sessionTimelineMutations,
);

const runtimeHealthEndpoint = {
  providesTags: [{ id: "CURRENT", type: "RuntimeHealth" }],
  queryFn: getRuntimeHealthQuery,
} as const;
const sessionGroupsEndpoint = {
  onCacheEntryAdded: sessionTimelineHandlers.handleSessionGroupsCacheEntryAdded,
  providesTags: [{ id: "LIST", type: "SessionGroups" }],
  queryFn: getSessionGroupsQuery,
} as const;
const openSessionEndpoint = {
  onQueryStarted: sessionTimelineHandlers.handleOpenSessionStarted,
  queryFn: openSessionQuery,
} as const;
const promptSessionEndpoint = {
  invalidatesTags: (
    _result: null | undefined,
    _error: unknown,
    { openSessionId }: PromptSessionMutationArg,
  ) => [{ id: openSessionId, type: "SessionTimeline" as const }],
  queryFn: promptSessionQuery,
} as const;
const readSessionTimelineEndpoint = {
  onCacheEntryAdded:
    sessionTimelineHandlers.handleSessionTimelineCacheEntryAdded,
  providesTags: (
    _result: SessionTimelineData | undefined,
    _error: unknown,
    { openSessionId }: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
  ) => [{ id: openSessionId, type: "SessionTimeline" as const }],
  queryFn: sessionTimelineHandlers.readSessionTimelineQueryFn,
} as const;
const loadOlderSessionTimelineEndpoint = {
  onQueryStarted: sessionTimelineHandlers.handleLoadOlderSessionTimelineStarted,
  queryFn: sessionTimelineHandlers.loadOlderTimelineQueryFn,
} as const;

const conduitApi = createApi({
  reducerPath: "conduitApi",
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ["Projects", "RuntimeHealth", "SessionGroups", "SessionTimeline"],
  endpoints: (builder) => ({
    listProjects: builder.query<ProjectListView, undefined>(
      projectListEndpoint,
    ),
    addProject: builder.mutation<ProjectListView, ProjectAddRequest>(
      projectAddEndpoint,
    ),
    removeProject: builder.mutation<ProjectListView, ProjectRemoveRequest>(
      projectRemoveEndpoint,
    ),
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
    readSessionTimeline: builder.query<
      SessionTimelineData,
      Pick<ReadSessionHistoryQueryArg, "openSessionId">
    >(readSessionTimelineEndpoint),
    loadOlderSessionTimeline: builder.mutation<
      SessionHistoryWindow,
      LoadOlderSessionTimelineArg
    >(loadOlderSessionTimelineEndpoint),
  }),
});

sessionTimelineMutations.upsertSessionTimeline = (dispatch, history): void => {
  void dispatch(
    conduitApi.util.upsertQueryData(
      "readSessionTimeline",
      { openSessionId: history.openSessionId },
      createSessionTimelineData(history),
    ),
  );
};

sessionTimelineMutations.invalidateSessionTimeline = (
  dispatch,
  openSessionId,
): void => {
  void dispatch(
    conduitApi.util.invalidateTags([
      { id: openSessionId, type: "SessionTimeline" },
    ]),
  );
};

sessionTimelineMutations.updateSessionTimelineItems = (
  dispatch,
  update,
): void => {
  void dispatch(
    conduitApi.util.updateQueryData(
      "readSessionTimeline",
      { openSessionId: update.openSessionId },
      (timeline) => {
        const nextTimeline = applyTimelineItems(
          timeline,
          update.revision,
          update.items,
        );
        timeline.history = nextTimeline.history;
        timeline.pagination = nextTimeline.pagination;
      },
    ),
  );
};

sessionTimelineMutations.markSessionTimelineOlderRequested = (
  dispatch,
  update,
): void => {
  void dispatch(
    conduitApi.util.updateQueryData(
      "readSessionTimeline",
      { openSessionId: update.openSessionId },
      (timeline) => {
        const nextTimeline = beginOlderPageLoad(timeline, update.cursor);
        timeline.history = nextTimeline.history;
        timeline.pagination = nextTimeline.pagination;
      },
    ),
  );
};

sessionTimelineMutations.mergeOlderSessionTimelinePage = (
  dispatch,
  update,
): void => {
  void dispatch(
    conduitApi.util.updateQueryData(
      "readSessionTimeline",
      { openSessionId: update.openSessionId },
      (timeline) => {
        const mergedTimeline = mergeOlderPage(timeline, {
          cursor: update.cursor,
          history: update.history,
        })[0];
        timeline.history = mergedTimeline.history;
        timeline.pagination = mergedTimeline.pagination;
      },
    ),
  );
};

sessionTimelineMutations.markSessionTimelineOlderFailed = (
  dispatch,
  update,
): void => {
  void dispatch(
    conduitApi.util.updateQueryData(
      "readSessionTimeline",
      { openSessionId: update.openSessionId },
      (timeline) => {
        const nextTimeline = failOlderPageLoad(timeline, update.cursor);
        timeline.history = nextTimeline.history;
        timeline.pagination = nextTimeline.pagination;
      },
    ),
  );
};

sessionTimelineMutations.invalidateSessionGroups = (
  dispatch: DispatchLike,
): void => {
  void dispatch(
    conduitApi.util.invalidateTags([{ id: "LIST", type: "SessionGroups" }]),
  );
};

export { conduitApi };
export type {
  LoadOlderSessionTimelineArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
};
