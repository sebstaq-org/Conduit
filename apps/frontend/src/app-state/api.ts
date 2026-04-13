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
  createSessionTimelineHandlers,
  createUninitializedSessionTimelineMutations,
} from "./api-session-timeline-handlers";
import { bindSessionTimelineMutations } from "./api-session-timeline-cache-wiring";
import {
  projectAddEndpoint,
  projectListEndpoint,
  projectRemoveEndpoint,
  projectSuggestionsEndpoint,
  projectUpdateEndpoint,
} from "./api-project-endpoints";
import { runtimeHealthEndpoint } from "./api-runtime-health-endpoint";
import { createSessionTimelineEndpoints } from "./api-session-timeline-endpoints";
import { createSessionTimelineData } from "./session-timeline-cache";
import type {
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  RuntimeHealthView,
} from "./session-api-queries";
import type { LoadOlderSessionTimelineArg } from "./api-session-timeline-handlers";
import type { SessionTimelineData } from "./session-timeline-cache";

type ProjectSuggestionsQueryArg = ProjectSuggestionsQuery | undefined;
type ProjectUpdateArg = ProjectUpdateRequest;

const sessionTimelineMutations = createUninitializedSessionTimelineMutations();
const sessionTimelineHandlers = createSessionTimelineHandlers(
  sessionTimelineMutations,
);
const sessionTimelineEndpoints = createSessionTimelineEndpoints(
  sessionTimelineHandlers,
);

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
    >(sessionTimelineEndpoints.sessionGroupsEndpoint),
    openSession: builder.mutation<SessionHistoryWindow, OpenSessionMutationArg>(
      sessionTimelineEndpoints.openSessionEndpoint,
    ),
    promptSession: builder.mutation<null, PromptSessionMutationArg>(
      sessionTimelineEndpoints.promptSessionEndpoint,
    ),
    readSessionTimeline: builder.query<
      SessionTimelineData,
      Pick<ReadSessionHistoryQueryArg, "openSessionId">
    >(sessionTimelineEndpoints.readSessionTimelineEndpoint),
    loadOlderSessionTimeline: builder.mutation<
      SessionHistoryWindow,
      LoadOlderSessionTimelineArg
    >(sessionTimelineEndpoints.loadOlderSessionTimelineEndpoint),
  }),
});

bindSessionTimelineMutations(sessionTimelineMutations, {
  upsertSessionTimeline: (dispatch, history): void => {
    void dispatch(
      conduitApi.util.upsertQueryData(
        "readSessionTimeline",
        { openSessionId: history.openSessionId },
        createSessionTimelineData(history),
      ),
    );
  },
  invalidateSessionTimeline: (dispatch, openSessionId): void => {
    void dispatch(
      conduitApi.util.invalidateTags([
        { id: openSessionId, type: "SessionTimeline" },
      ]),
    );
  },
  updateSessionTimeline: (dispatch, openSessionId, updater): void => {
    void dispatch(
      conduitApi.util.updateQueryData(
        "readSessionTimeline",
        { openSessionId },
        updater,
      ),
    );
  },
  invalidateSessionGroups: (dispatch): void => {
    void dispatch(
      conduitApi.util.invalidateTags([{ id: "LIST", type: "SessionGroups" }]),
    );
  },
});

export { conduitApi };
export type {
  LoadOlderSessionTimelineArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
};
