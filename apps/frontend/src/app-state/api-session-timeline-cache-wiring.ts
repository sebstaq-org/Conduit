import {
  applyTimelineItems,
  beginOlderPageLoad,
  failOlderPageLoad,
  mergeOlderPage,
} from "./session-timeline-cache";
import type { SessionHistoryWindow } from "@conduit/session-client";
import type { SessionTimelineMutations } from "./api-session-timeline-handlers";
import type { SessionTimelineData } from "./session-timeline-cache";

type DispatchLike = (action: unknown) => unknown;

interface SessionTimelineCacheApi {
  invalidateSessionGroups: (dispatch: DispatchLike) => void;
  invalidateSessionTimeline: (
    dispatch: DispatchLike,
    openSessionId: string,
  ) => void;
  upsertSessionTimeline: (
    dispatch: DispatchLike,
    history: SessionHistoryWindow,
  ) => void;
  updateSessionTimeline: (
    dispatch: DispatchLike,
    openSessionId: string,
    updater: (timeline: SessionTimelineData) => void,
  ) => void;
}

function createUpdateTimelineItemsMutation(
  cacheApi: SessionTimelineCacheApi,
): SessionTimelineMutations["updateSessionTimelineItems"] {
  return (dispatch, update): void => {
    cacheApi.updateSessionTimeline(
      dispatch,
      update.openSessionId,
      (timeline) => {
        const nextTimeline = applyTimelineItems(
          timeline,
          update.revision,
          update.items,
        );
        timeline.history = nextTimeline.history;
        timeline.pagination = nextTimeline.pagination;
      },
    );
  };
}

function createMarkOlderRequestedMutation(
  cacheApi: SessionTimelineCacheApi,
): SessionTimelineMutations["markSessionTimelineOlderRequested"] {
  return (dispatch, update): void => {
    cacheApi.updateSessionTimeline(
      dispatch,
      update.openSessionId,
      (timeline) => {
        const nextTimeline = beginOlderPageLoad(timeline, update.cursor);
        timeline.history = nextTimeline.history;
        timeline.pagination = nextTimeline.pagination;
      },
    );
  };
}

function createMergeOlderPageMutation(
  cacheApi: SessionTimelineCacheApi,
): SessionTimelineMutations["mergeOlderSessionTimelinePage"] {
  return (dispatch, update): void => {
    cacheApi.updateSessionTimeline(
      dispatch,
      update.openSessionId,
      (timeline) => {
        const mergedTimeline = mergeOlderPage(timeline, {
          cursor: update.cursor,
          history: update.history,
        })[0];
        timeline.history = mergedTimeline.history;
        timeline.pagination = mergedTimeline.pagination;
      },
    );
  };
}

function createMarkOlderFailedMutation(
  cacheApi: SessionTimelineCacheApi,
): SessionTimelineMutations["markSessionTimelineOlderFailed"] {
  return (dispatch, update): void => {
    cacheApi.updateSessionTimeline(
      dispatch,
      update.openSessionId,
      (timeline) => {
        const nextTimeline = failOlderPageLoad(timeline, update.cursor);
        timeline.history = nextTimeline.history;
        timeline.pagination = nextTimeline.pagination;
      },
    );
  };
}

function bindSessionTimelineMutations(
  mutations: SessionTimelineMutations,
  cacheApi: SessionTimelineCacheApi,
): void {
  mutations.upsertSessionTimeline = (dispatch, history): void => {
    cacheApi.upsertSessionTimeline(dispatch, history);
  };

  mutations.invalidateSessionTimeline = (dispatch, openSessionId): void => {
    cacheApi.invalidateSessionTimeline(dispatch, openSessionId);
  };

  mutations.updateSessionTimelineItems =
    createUpdateTimelineItemsMutation(cacheApi);
  mutations.markSessionTimelineOlderRequested =
    createMarkOlderRequestedMutation(cacheApi);
  mutations.mergeOlderSessionTimelinePage =
    createMergeOlderPageMutation(cacheApi);
  mutations.markSessionTimelineOlderFailed =
    createMarkOlderFailedMutation(cacheApi);

  mutations.invalidateSessionGroups = (dispatch): void => {
    cacheApi.invalidateSessionGroups(dispatch);
  };
}

export { bindSessionTimelineMutations };
export type { DispatchLike, SessionTimelineCacheApi };
