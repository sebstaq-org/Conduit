import type {
  SessionGroupsQuery,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  TranscriptItem,
} from "@conduit/session-client";
import type {
  NewSessionMutationArg,
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

export type {
  CacheLifecycleApi,
  DispatchLike,
  LoadOlderSessionTimelineArg,
  NewSessionQueryStartedApi,
  OlderTimelinePageUpdate,
  OpenSessionQueryStartedApi,
  QueryStartedApi,
  SessionTimelineHandlers,
  SessionTimelineMutations,
  TimelineItemsUpdate,
};
