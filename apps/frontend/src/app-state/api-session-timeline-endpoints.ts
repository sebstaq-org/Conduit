import {
  getSessionGroupsQuery,
  openSessionQuery,
  promptSessionQuery,
} from "./session-api-queries";
import type { SessionTimelineHandlers } from "./api-session-timeline-handlers";
import type {
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
} from "./session-api-queries";
import type { SessionTimelineData } from "./session-timeline-cache";

interface SessionTimelineEndpoints {
  loadOlderSessionTimelineEndpoint: {
    onQueryStarted: SessionTimelineHandlers["handleLoadOlderSessionTimelineStarted"];
    queryFn: SessionTimelineHandlers["loadOlderTimelineQueryFn"];
  };
  openSessionEndpoint: {
    onQueryStarted: SessionTimelineHandlers["handleOpenSessionStarted"];
    queryFn: typeof openSessionQuery;
  };
  promptSessionEndpoint: {
    invalidatesTags: (
      result: null | undefined,
      error: unknown,
      arg: PromptSessionMutationArg,
    ) => { id: string; type: "SessionTimeline" }[];
    queryFn: typeof promptSessionQuery;
  };
  readSessionTimelineEndpoint: {
    onCacheEntryAdded: SessionTimelineHandlers["handleSessionTimelineCacheEntryAdded"];
    providesTags: (
      result: SessionTimelineData | undefined,
      error: unknown,
      arg: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
    ) => { id: string; type: "SessionTimeline" }[];
    queryFn: SessionTimelineHandlers["readSessionTimelineQueryFn"];
  };
  sessionGroupsEndpoint: {
    onCacheEntryAdded: SessionTimelineHandlers["handleSessionGroupsCacheEntryAdded"];
    providesTags: readonly [{ id: "LIST"; type: "SessionGroups" }];
    queryFn: typeof getSessionGroupsQuery;
  };
}

function createSessionTimelineEndpoints(
  handlers: SessionTimelineHandlers,
): SessionTimelineEndpoints {
  const sessionGroupsEndpoint = {
    onCacheEntryAdded: handlers.handleSessionGroupsCacheEntryAdded,
    providesTags: [{ id: "LIST", type: "SessionGroups" }] as const,
    queryFn: getSessionGroupsQuery,
  };

  const openSessionEndpoint = {
    onQueryStarted: handlers.handleOpenSessionStarted,
    queryFn: openSessionQuery,
  } as const;

  const promptSessionEndpoint = {
    invalidatesTags: (
      _result: null | undefined,
      _error: unknown,
      { openSessionId }: PromptSessionMutationArg,
    ): { id: string; type: "SessionTimeline" }[] => [
      { id: openSessionId, type: "SessionTimeline" },
    ],
    queryFn: promptSessionQuery,
  };

  const readSessionTimelineEndpoint = {
    onCacheEntryAdded: handlers.handleSessionTimelineCacheEntryAdded,
    providesTags: (
      _result: SessionTimelineData | undefined,
      _error: unknown,
      { openSessionId }: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
    ): { id: string; type: "SessionTimeline" }[] => [
      { id: openSessionId, type: "SessionTimeline" },
    ],
    queryFn: handlers.readSessionTimelineQueryFn,
  };

  const loadOlderSessionTimelineEndpoint = {
    onQueryStarted: handlers.handleLoadOlderSessionTimelineStarted,
    queryFn: handlers.loadOlderTimelineQueryFn,
  };

  return {
    loadOlderSessionTimelineEndpoint,
    openSessionEndpoint,
    promptSessionEndpoint,
    readSessionTimelineEndpoint,
    sessionGroupsEndpoint,
  };
}

export { createSessionTimelineEndpoints };
