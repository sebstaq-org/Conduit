import type {
  SessionGroupsQuery,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  TranscriptItem,
} from "@conduit/session-client";
import { readSessionHistoryQuery, sessionClient } from "./session-api-queries";
import { createUninitializedSessionTimelineMutations } from "./api-session-timeline-mutations";
import { subscribeSessionIndexInvalidation } from "./session-index-subscription";
import { activeSessionOpened } from "./session-selection";
import { createSessionTimelineData } from "./session-timeline-cache";
import type {
  OpenSessionMutationArg,
  NewSessionMutationArg,
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

interface OpenSessionQueryStartedApi {
  dispatch: DispatchLike;
  queryFulfilled: Promise<{ data: SessionOpenResult }>;
}

interface NewSessionQueryStartedApi {
  dispatch: DispatchLike;
  queryFulfilled: Promise<{ data: SessionNewResult }>;
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
    api: OpenSessionQueryStartedApi,
  ) => Promise<void>;
  handleNewSessionStarted: (
    arg: NewSessionMutationArg,
    api: NewSessionQueryStartedApi,
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
  { cwd, provider, title }: OpenSessionMutationArg,
  { dispatch, queryFulfilled }: OpenSessionQueryStartedApi,
  mutations: SessionTimelineMutations,
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    const history: SessionHistoryWindow = {
      openSessionId: data.openSessionId,
      revision: data.revision,
      items: data.items,
      nextCursor: data.nextCursor,
    };
    dispatch(
      activeSessionOpened({
        configOptions: data.configOptions ?? null,
        configSyncBlocked: false,
        configSyncError: null,
        cwd,
        kind: "open",
        modes: data.modes ?? null,
        models: data.models ?? null,
        openSessionId: history.openSessionId,
        provider,
        sessionId: data.sessionId,
        title,
      }),
    );
    mutations.upsertSessionTimeline(dispatch, history);
  } catch {
    // The query result already carries the user-visible failure.
  }
}

async function handleNewSessionStarted(
  { cwd, provider }: NewSessionMutationArg,
  { dispatch, queryFulfilled }: NewSessionQueryStartedApi,
  mutations: SessionTimelineMutations,
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    dispatch(
      activeSessionOpened({
        configOptions: data.configOptions ?? null,
        configSyncBlocked: false,
        configSyncError: null,
        cwd,
        kind: "open",
        openSessionId: data.history.openSessionId,
        modes: data.modes ?? null,
        models: data.models ?? null,
        provider,
        sessionId: data.sessionId,
        title: null,
      }),
    );
    mutations.upsertSessionTimeline(dispatch, data.history);
    mutations.invalidateSessionGroups(dispatch);
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
