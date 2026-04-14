import type { SessionTimelineMutations } from "./api-session-timeline-handlers";

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

export { createUninitializedSessionTimelineMutations };
