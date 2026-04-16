import type {
  SessionGroupsQuery,
  SessionHistoryWindow,
  SessionOpenResult,
} from "@conduit/session-client";
import { createUninitializedSessionTimelineMutations } from "./api-session-timeline-mutations";
import { subscribeSessionIndexInvalidation } from "./session-index-subscription";
import { readSessionHistoryQuery, sessionClient } from "./session-api-queries";
import { activeSessionOpened } from "./session-selection";
import { createSessionTimelineData } from "./session-timeline-cache";
import { logFailure, logInfo } from "./frontend-logger";
import type {
  CacheLifecycleApi,
  LoadOlderSessionTimelineArg,
  NewSessionQueryStartedApi,
  OpenSessionQueryStartedApi,
  QueryStartedApi,
  SessionTimelineHandlers,
  SessionTimelineMutations,
} from "./api-session-timeline-types";
import type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  ReadSessionHistoryQueryArg,
} from "./session-api-queries";
import type { SessionTimelineData } from "./session-timeline-cache";

async function handleSessionGroupsCacheEntryAdded(
  _query: SessionGroupsQuery | undefined,
  { cacheDataLoaded, cacheEntryRemoved, dispatch }: CacheLifecycleApi,
  mutations: SessionTimelineMutations,
): Promise<void> {
  let unsubscribes: (() => void)[] = [];
  try {
    await cacheDataLoaded;
    unsubscribes = await subscribeSessionIndexInvalidation(
      sessionClient,
      dispatch,
      mutations.invalidateSessionGroups,
    );
    await cacheEntryRemoved;
  } finally {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  }
}

async function handleSessionTimelineCacheEntryAdded(
  { openSessionId }: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
  { cacheDataLoaded, cacheEntryRemoved, dispatch }: CacheLifecycleApi,
  mutations: SessionTimelineMutations,
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
          mutations.updateSessionTimelineItems(dispatch, {
            items: event.items,
            openSessionId,
            revision: event.revision,
          });
          return;
        }
        mutations.invalidateSessionTimeline(dispatch, openSessionId);
      },
    );
    await cacheEntryRemoved;
  } finally {
    unsubscribe?.();
  }
}

function openResultHistory(data: SessionOpenResult): SessionHistoryWindow {
  return {
    openSessionId: data.openSessionId,
    revision: data.revision,
    items: data.items,
    nextCursor: data.nextCursor,
  };
}

async function handleOpenSessionStarted(
  { cwd, provider, title }: OpenSessionMutationArg,
  { dispatch, queryFulfilled }: OpenSessionQueryStartedApi,
  mutations: SessionTimelineMutations,
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    const history = openResultHistory(data);
    logInfo("frontend.session.open.post_query.start", {
      open_session_id: history.openSessionId,
      provider,
      request_cwd: cwd,
      request_title: title,
      session_id: data.sessionId,
    });
    dispatch(
      activeSessionOpened({
        configOptions: data.configOptions ?? null,
        configSyncBlocked: false,
        configSyncError: null,
        cwd,
        kind: "open",
        modes: data.modes,
        models: data.models,
        openSessionId: history.openSessionId,
        provider,
        sessionId: data.sessionId,
        title,
      }),
    );
    mutations.upsertSessionTimeline(dispatch, history);
    logInfo("frontend.session.open.post_query.finish", {
      ok: true,
      open_session_id: history.openSessionId,
      provider,
      session_id: data.sessionId,
    });
  } catch (error) {
    logFailure("frontend.session.open.post_query.failed", error, {
      provider,
      request_cwd: cwd,
      request_title: title,
    });
  }
}

async function handleNewSessionStarted(
  { cwd, provider }: NewSessionMutationArg,
  { dispatch, queryFulfilled }: NewSessionQueryStartedApi,
  mutations: SessionTimelineMutations,
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    logInfo("frontend.session.new.post_query.start", {
      open_session_id: data.history.openSessionId,
      provider,
      request_cwd: cwd,
      session_id: data.sessionId,
    });
    dispatch(
      activeSessionOpened({
        configOptions: data.configOptions ?? null,
        configSyncBlocked: false,
        configSyncError: null,
        cwd,
        kind: "open",
        openSessionId: data.history.openSessionId,
        modes: data.modes,
        models: data.models,
        provider,
        sessionId: data.sessionId,
        title: null,
      }),
    );
    mutations.upsertSessionTimeline(dispatch, data.history);
    mutations.invalidateSessionGroups(dispatch);
    logInfo("frontend.session.new.post_query.finish", {
      ok: true,
      open_session_id: data.history.openSessionId,
      provider,
      session_id: data.sessionId,
    });
  } catch (error) {
    logFailure("frontend.session.new.post_query.failed", error, {
      provider,
      request_cwd: cwd,
    });
  }
}

async function readSessionTimelineQueryFn({
  openSessionId,
}: Pick<ReadSessionHistoryQueryArg, "openSessionId">): Promise<
  { data: SessionTimelineData } | { error: string }
> {
  const response = await readSessionHistoryQuery({ openSessionId });
  if ("error" in response) {
    return response;
  }
  return { data: createSessionTimelineData(response.data) };
}

async function loadOlderTimelineQueryFn({
  cursor,
  limit,
  openSessionId,
}: LoadOlderSessionTimelineArg): Promise<
  { data: SessionHistoryWindow } | { error: string }
> {
  const response = await readSessionHistoryQuery({
    cursor,
    limit,
    openSessionId,
  });
  return response;
}

async function handleLoadOlderSessionTimelineStarted(
  arg: LoadOlderSessionTimelineArg,
  { dispatch, queryFulfilled }: QueryStartedApi,
  mutations: SessionTimelineMutations,
): Promise<void> {
  mutations.markSessionTimelineOlderRequested(dispatch, arg);
  try {
    const { data } = await queryFulfilled;
    mutations.mergeOlderSessionTimelinePage(dispatch, {
      cursor: arg.cursor,
      history: data,
      openSessionId: arg.openSessionId,
    });
  } catch {
    mutations.markSessionTimelineOlderFailed(dispatch, arg);
  }
}

function createSessionTimelineHandlers(
  mutations: SessionTimelineMutations,
): SessionTimelineHandlers {
  return {
    handleLoadOlderSessionTimelineStarted: async (arg, api) => {
      await handleLoadOlderSessionTimelineStarted(arg, api, mutations);
    },
    handleOpenSessionStarted: async (arg, api) => {
      await handleOpenSessionStarted(arg, api, mutations);
    },
    handleNewSessionStarted: async (arg, api) => {
      await handleNewSessionStarted(arg, api, mutations);
    },
    handleSessionGroupsCacheEntryAdded: async (query, api) => {
      await handleSessionGroupsCacheEntryAdded(query, api, mutations);
    },
    handleSessionTimelineCacheEntryAdded: async (arg, api) => {
      await handleSessionTimelineCacheEntryAdded(arg, api, mutations);
    },
    loadOlderTimelineQueryFn,
    readSessionTimelineQueryFn,
  };
}

export {
  createSessionTimelineHandlers,
  createUninitializedSessionTimelineMutations,
};
export type {
  LoadOlderSessionTimelineArg,
  NewSessionMutationArg,
  SessionTimelineHandlers,
  SessionTimelineMutations,
};
