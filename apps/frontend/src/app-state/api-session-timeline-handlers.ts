import type {
  SessionGroupsQuery,
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";
import { readSessionHistoryQuery, sessionClient } from "./session-api-queries";
import { subscribeSessionIndexInvalidation } from "./session-index-subscription";
import { activeSessionOpened } from "./session-selection";
import { createSessionTimelineData } from "./session-timeline-cache";
import type {
  OpenSessionMutationArg,
  ReadSessionHistoryQueryArg,
} from "./session-api-queries";
import type { SessionTimelineData } from "./session-timeline-cache";

type DispatchLike = (action: unknown) => unknown;

interface CacheLifecycleApi {
  cacheDataLoaded: Promise<unknown>;
  cacheEntryRemoved: Promise<unknown>;
  dispatch: DispatchLike;
}

interface QueryStartedApi {
  dispatch: DispatchLike;
  queryFulfilled: Promise<{ data: SessionHistoryWindow }>;
}

interface LoadOlderSessionTimelineArg {
  cursor: string;
  limit?: number;
  openSessionId: string;
}

interface TimelineItemsUpdate {
  openSessionId: string;
  revision: number;
  items: TranscriptItem[];
}

interface OlderTimelinePageUpdate {
  cursor: string;
  history: SessionHistoryWindow;
  openSessionId: string;
}

interface SessionTimelineMutations {
  upsertSessionTimeline: (
    dispatch: DispatchLike,
    history: SessionHistoryWindow,
  ) => void;
  invalidateSessionTimeline: (
    dispatch: DispatchLike,
    openSessionId: string,
  ) => void;
  updateSessionTimelineItems: (
    dispatch: DispatchLike,
    update: TimelineItemsUpdate,
  ) => void;
  markSessionTimelineOlderRequested: (
    dispatch: DispatchLike,
    update: LoadOlderSessionTimelineArg,
  ) => void;
  mergeOlderSessionTimelinePage: (
    dispatch: DispatchLike,
    update: OlderTimelinePageUpdate,
  ) => void;
  markSessionTimelineOlderFailed: (
    dispatch: DispatchLike,
    update: LoadOlderSessionTimelineArg,
  ) => void;
  invalidateSessionGroups: (dispatch: DispatchLike) => void;
}

interface SessionTimelineHandlers {
  handleLoadOlderSessionTimelineStarted: (
    arg: LoadOlderSessionTimelineArg,
    api: QueryStartedApi,
  ) => Promise<void>;
  handleOpenSessionStarted: (
    arg: OpenSessionMutationArg,
    api: QueryStartedApi,
  ) => Promise<void>;
  handleSessionGroupsCacheEntryAdded: (
    query: SessionGroupsQuery | undefined,
    api: CacheLifecycleApi,
  ) => Promise<void>;
  handleSessionTimelineCacheEntryAdded: (
    arg: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
    api: CacheLifecycleApi,
  ) => Promise<void>;
  loadOlderTimelineQueryFn: (
    arg: LoadOlderSessionTimelineArg,
  ) => Promise<{ data: SessionHistoryWindow } | { error: string }>;
  readSessionTimelineQueryFn: (
    arg: Pick<ReadSessionHistoryQueryArg, "openSessionId">,
  ) => Promise<{ data: SessionTimelineData } | { error: string }>;
}

function uninitializedMutation(methodName: string): never {
  throw new Error(`${methodName} is not initialized`);
}

function createUninitializedSessionTimelineMutations(): SessionTimelineMutations {
  return {
    invalidateSessionGroups: () =>
      uninitializedMutation("invalidateSessionGroups"),
    invalidateSessionTimeline: () =>
      uninitializedMutation("invalidateSessionTimeline"),
    markSessionTimelineOlderFailed: () =>
      uninitializedMutation("markSessionTimelineOlderFailed"),
    markSessionTimelineOlderRequested: () =>
      uninitializedMutation("markSessionTimelineOlderRequested"),
    mergeOlderSessionTimelinePage: () =>
      uninitializedMutation("mergeOlderSessionTimelinePage"),
    updateSessionTimelineItems: () =>
      uninitializedMutation("updateSessionTimelineItems"),
    upsertSessionTimeline: () => uninitializedMutation("upsertSessionTimeline"),
  };
}

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

async function handleOpenSessionStarted(
  { cwd, provider, sessionId, title }: OpenSessionMutationArg,
  { dispatch, queryFulfilled }: QueryStartedApi,
  mutations: SessionTimelineMutations,
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
    mutations.upsertSessionTimeline(dispatch, data);
  } catch {
    // The query result already carries the user-visible failure.
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
  SessionTimelineHandlers,
  SessionTimelineMutations,
};
