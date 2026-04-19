import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  createSessionTimelineHandlers,
  createUninitializedSessionTimelineMutations,
} from "./api-session-timeline-handlers";
import { bindSessionTimelineMutations } from "./api-session-timeline-cache-wiring";
import { setSessionConfigOptionEndpoint } from "./api-session-config-option-endpoint";
import {
  projectAddEndpoint,
  projectListEndpoint,
  projectRemoveEndpoint,
  projectSuggestionsEndpoint,
  projectUpdateEndpoint,
} from "./api-project-endpoints";
import { getRuntimeHealthQuery } from "./api-runtime-health-query";
import { respondInteractionEndpoint } from "./api-session-respond-interaction-endpoint";
import { createSessionTimelineEndpoints } from "./api-session-timeline-endpoints";
import { createSessionTimelineData } from "./session-timeline-cache";
import {
  getSettingsQuery,
  getProvidersConfigSnapshotQuery,
  updateSettingsQuery,
} from "./session-api-queries";
import type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  SetSessionConfigOptionMutationArg,
} from "./session-api-queries";
import type { RespondInteractionMutationArg } from "./api-session-respond-interaction-endpoint";
import type { LoadOlderSessionTimelineArg } from "./api-session-timeline-handlers";

const sessionTimelineMutations = createUninitializedSessionTimelineMutations();
const sessionTimelineHandlers = createSessionTimelineHandlers(
  sessionTimelineMutations,
);
const sessionTimelineEndpoints = createSessionTimelineEndpoints(
  sessionTimelineHandlers,
);

const globalSettingsEndpoint = {
  providesTags: [{ id: "GLOBAL", type: "Settings" }],
  queryFn: getSettingsQuery,
} as const;
const updateSettingsEndpoint = {
  invalidatesTags: [
    { id: "GLOBAL", type: "Settings" },
    { id: "LIST", type: "SessionGroups" },
  ],
  queryFn: updateSettingsQuery,
} as const;
const runtimeHealthEndpoint = {
  providesTags: [{ id: "CURRENT", type: "RuntimeHealth" }],
  queryFn: getRuntimeHealthQuery,
} as const;
const providersConfigSnapshotEndpoint = {
  providesTags: [{ id: "CURRENT", type: "ProviderConfigSnapshot" }],
  queryFn: getProvidersConfigSnapshotQuery,
} as const;

const conduitApi = createApi({
  reducerPath: "conduitApi",
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: [
    "Projects",
    "ProviderConfigSnapshot",
    "RuntimeHealth",
    "SessionGroups",
    "SessionTimeline",
    "Settings",
  ],
  endpoints: (builder) => ({
    listProjects: builder.query(projectListEndpoint),
    addProject: builder.mutation(projectAddEndpoint),
    removeProject: builder.mutation(projectRemoveEndpoint),
    updateProject: builder.mutation(projectUpdateEndpoint),
    getProjectSuggestions: builder.query(projectSuggestionsEndpoint),
    getRuntimeHealth: builder.query(runtimeHealthEndpoint),
    getProvidersConfigSnapshot: builder.query(providersConfigSnapshotEndpoint),
    getSettings: builder.query(globalSettingsEndpoint),
    getSessionGroups: builder.query(
      sessionTimelineEndpoints.sessionGroupsEndpoint,
    ),
    updateSettings: builder.mutation(updateSettingsEndpoint),
    openSession: builder.mutation(sessionTimelineEndpoints.openSessionEndpoint),
    newSession: builder.mutation(sessionTimelineEndpoints.newSessionEndpoint),
    setSessionConfigOption: builder.mutation(setSessionConfigOptionEndpoint),
    promptSession: builder.mutation(
      sessionTimelineEndpoints.promptSessionEndpoint,
    ),
    respondInteraction: builder.mutation(respondInteractionEndpoint),
    readSessionTimeline: builder.query(
      sessionTimelineEndpoints.readSessionTimelineEndpoint,
    ),
    loadOlderSessionTimeline: builder.mutation(
      sessionTimelineEndpoints.loadOlderSessionTimelineEndpoint,
    ),
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
  NewSessionMutationArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  RespondInteractionMutationArg,
  SetSessionConfigOptionMutationArg,
};
