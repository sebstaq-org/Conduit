import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { createSessionClient } from "@conduit/session-client";
import type {
  ContentBlock,
  ProviderId,
  SessionHistoryWindow,
  SessionGroupsQuery,
  SessionGroupsView,
} from "@conduit/session-client";
import { subscribeSessionIndexInvalidation } from "./session-index-subscription";
import { activeSessionOpened } from "./session-selection";

const sessionClient = createSessionClient();

interface OpenSessionMutationArg {
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
  limit?: number;
}

interface ReadSessionHistoryQueryArg {
  provider: ProviderId;
  openSessionId: string;
  cursor?: string | null;
  limit?: number;
}

interface PromptSessionMutationArg {
  provider: ProviderId;
  openSessionId: string;
  prompt: ContentBlock[];
}

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
  provider: ProviderId,
  history: SessionHistoryWindow,
) => void;
type InvalidateSessionHistory = (
  dispatch: DispatchLike,
  openSessionId: string,
) => void;
type InvalidateSessionGroups = (dispatch: DispatchLike) => void;
type QueryResult<ResponseData> = Promise<
  { data: ResponseData } | { error: string }
>;

let upsertSessionHistory: UpsertSessionHistory = (): void => {
  throw new Error("session history cache upsert is not initialized");
};
let invalidateSessionHistory: InvalidateSessionHistory = (): void => {
  throw new Error("session history invalidation is not initialized");
};
let invalidateSessionGroups: InvalidateSessionGroups = (): void => {
  throw new Error("session groups invalidation is not initialized");
};

function toQueryError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "session request failed";
}

async function getSessionGroupsQuery(
  query: SessionGroupsQuery | undefined,
): QueryResult<SessionGroupsView> {
  try {
    const data = await sessionClient.getSessionGroups(query);
    return { data };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function openSessionQuery({
  cwd,
  limit,
  provider,
  sessionId,
}: OpenSessionMutationArg): QueryResult<SessionHistoryWindow> {
  try {
    const response = await sessionClient.openSession(provider, {
      cwd,
      limit,
      sessionId,
    });
    if (!response.ok) {
      return { error: response.error?.message ?? "session open failed" };
    }
    if (response.result === null) {
      return { error: "session open returned no history" };
    }
    return { data: response.result };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function readSessionHistoryQuery({
  cursor,
  limit,
  openSessionId,
  provider,
}: ReadSessionHistoryQueryArg): QueryResult<SessionHistoryWindow> {
  try {
    const response = await sessionClient.readSessionHistory(provider, {
      cursor,
      limit,
      openSessionId,
    });
    if (!response.ok) {
      return { error: response.error?.message ?? "session history failed" };
    }
    if (response.result === null) {
      return { error: "session history returned no window" };
    }
    return { data: response.result };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

async function promptSessionQuery({
  openSessionId,
  prompt,
  provider,
}: PromptSessionMutationArg): QueryResult<null> {
  try {
    await sessionClient.promptSession(provider, { openSessionId, prompt });
    return { data: null };
  } catch (error) {
    return { error: toQueryError(error) };
  }
}

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
    upsertSessionHistory(dispatch, provider, data);
  } catch {
    // The query result already carries the user-visible failure.
  }
}

async function handleSessionHistoryCacheEntryAdded(
  { openSessionId, provider }: ReadSessionHistoryQueryArg,
  { cacheDataLoaded, cacheEntryRemoved, dispatch }: CacheLifecycleApi,
): Promise<void> {
  let unsubscribe: (() => void) | null = null;
  try {
    await cacheDataLoaded;
    unsubscribe = await sessionClient.subscribeTimelineChanges(
      provider,
      (event) => {
        if (event.openSessionId !== openSessionId) {
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

const conduitApi = createApi({
  reducerPath: "conduitApi",
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ["SessionGroups", "SessionHistory"],
  endpoints: (builder) => ({
    getSessionGroups: builder.query<
      SessionGroupsView,
      SessionGroupsQuery | undefined
    >({
      onCacheEntryAdded: handleSessionGroupsCacheEntryAdded,
      providesTags: [{ id: "LIST", type: "SessionGroups" }],
      queryFn: getSessionGroupsQuery,
    }),
    openSession: builder.mutation<SessionHistoryWindow, OpenSessionMutationArg>(
      {
        queryFn: openSessionQuery,
        onQueryStarted: handleOpenSessionStarted,
      },
    ),
    promptSession: builder.mutation<null, PromptSessionMutationArg>({
      invalidatesTags: (_result, _error, { openSessionId }) => [
        { id: openSessionId, type: "SessionHistory" },
      ],
      queryFn: promptSessionQuery,
    }),
    readSessionHistory: builder.query<
      SessionHistoryWindow,
      ReadSessionHistoryQueryArg
    >({
      onCacheEntryAdded: handleSessionHistoryCacheEntryAdded,
      providesTags: (_result, _error, { openSessionId }) => [
        { id: openSessionId, type: "SessionHistory" },
      ],
      queryFn: readSessionHistoryQuery,
    }),
  }),
});

upsertSessionHistory = (dispatch, provider, history): void => {
  void dispatch(
    conduitApi.util.upsertQueryData(
      "readSessionHistory",
      { openSessionId: history.openSessionId, provider },
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

invalidateSessionGroups = (dispatch): void => {
  void dispatch(
    conduitApi.util.invalidateTags([{ id: "LIST", type: "SessionGroups" }]),
  );
};

const {
  useGetSessionGroupsQuery,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useReadSessionHistoryQuery,
} = conduitApi;

export {
  conduitApi,
  useGetSessionGroupsQuery,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useReadSessionHistoryQuery,
};
export type {
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
};
