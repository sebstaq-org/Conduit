import {
  getSessionGroupsQuery,
  newSessionQuery,
  openSessionQuery,
  promptSessionQuery,
} from "./session-api-queries";
import type { SessionTimelineHandlers } from "./api-session-timeline-handlers";
import type {
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
} from "./session-api-queries";
import type { SessionTimelineData } from "./session-timeline-cache";

interface SessionTimelineTag {
  id: string;
  type: "SessionTimeline";
}

interface SessionTimelineEndpoints {
  loadOlderSessionTimelineEndpoint: {
    onQueryStarted: SessionTimelineHandlers["handleLoadOlderSessionTimelineStarted"];
    queryFn: SessionTimelineHandlers["loadOlderTimelineQueryFn"];
  };
  openSessionEndpoint: {
    onQueryStarted: SessionTimelineHandlers["handleOpenSessionStarted"];
    queryFn: typeof openSessionQuery;
  };
  newSessionEndpoint: {
    onQueryStarted: SessionTimelineHandlers["handleNewSessionStarted"];
    queryFn: typeof newSessionQuery;
  };
  promptSessionEndpoint: {
    invalidatesTags: (
      result: null | undefined,
      error: unknown,
      arg: PromptSessionMutationArg,
    ) => SessionTimelineTag[];
    queryFn: typeof promptSessionQuery;
  };
  readSessionTimelineEndpoint: {
    onCacheEntryAdded: SessionTimelineHandlers["handleSessionTimelineCacheEntryAdded"];
    providesTags: (
      result: SessionTimelineData | undefined,
      error: unknown,
      arg: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
    ) => SessionTimelineTag[];
    queryFn: SessionTimelineHandlers["readSessionTimelineQueryFn"];
  };
  sessionGroupsEndpoint: {
    onCacheEntryAdded: SessionTimelineHandlers["handleSessionGroupsCacheEntryAdded"];
    providesTags: readonly [{ id: "LIST"; type: "SessionGroups" }];
    queryFn: typeof getSessionGroupsQuery;
  };
}

function sessionTimelineTag(openSessionId: string): SessionTimelineTag[] {
  return [{ id: openSessionId, type: "SessionTimeline" }];
}

function promptSessionInvalidatesTags(
  _result: null | undefined,
  _error: unknown,
  { openSessionId }: PromptSessionMutationArg,
): SessionTimelineTag[] {
  return sessionTimelineTag(openSessionId);
}

function readSessionTimelineProvidesTags(
  _result: SessionTimelineData | undefined,
  _error: unknown,
  { openSessionId }: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
): SessionTimelineTag[] {
  return sessionTimelineTag(openSessionId);
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

  const newSessionEndpoint = {
    onQueryStarted: handlers.handleNewSessionStarted,
    queryFn: newSessionQuery,
  } as const;

  const promptSessionEndpoint = {
    invalidatesTags: promptSessionInvalidatesTags,
    queryFn: promptSessionQuery,
  };

  const readSessionTimelineEndpoint = {
    onCacheEntryAdded: handlers.handleSessionTimelineCacheEntryAdded,
    providesTags: readSessionTimelineProvidesTags,
    queryFn: handlers.readSessionTimelineQueryFn,
  };

  const loadOlderSessionTimelineEndpoint = {
    onQueryStarted: handlers.handleLoadOlderSessionTimelineStarted,
    queryFn: handlers.loadOlderTimelineQueryFn,
  };

  return {
    loadOlderSessionTimelineEndpoint,
    newSessionEndpoint,
    openSessionEndpoint,
    promptSessionEndpoint,
    readSessionTimelineEndpoint,
    sessionGroupsEndpoint,
  };
}

export { createSessionTimelineEndpoints };
