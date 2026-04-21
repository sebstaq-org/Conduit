import { useCallback } from "react";
import { useSelector } from "react-redux";
import {
  selectActiveSession,
  useLoadOlderSessionTimelineMutation,
  useSessionTimeline,
} from "@/app-state";
import type { ActiveSession } from "@/app-state";
import { Box, Text } from "@/theme";
import { SessionHistoryList } from "./session-history-list";
import type { ViewStyle } from "react-native";

type HistoryRenderState = "loading" | "ready" | "unavailable";

const historyStatusVariant = "rowLabelMuted" as const;
const historyRootStyle: ViewStyle = { minHeight: 0, position: "relative" };
const historyOverlayStyle: ViewStyle = {
  alignItems: "center",
  left: 0,
  position: "absolute",
  right: 0,
  top: 8,
  zIndex: 1,
};

function renderNoActiveSession(): React.JSX.Element {
  return (
    <Box flex={1}>
      <Text variant={historyStatusVariant}>Select a session</Text>
    </Box>
  );
}

function renderHistoryUnavailable(): React.JSX.Element {
  return (
    <Box flex={1}>
      <Text variant={historyStatusVariant}>Session unavailable</Text>
    </Box>
  );
}

function renderHistoryLoading(): React.JSX.Element {
  return (
    <Box flex={1}>
      <Text variant={historyStatusVariant}>Loading session</Text>
    </Box>
  );
}

function historyRenderState(
  timeline: Pick<
    ReturnType<typeof useSessionTimeline>,
    "history" | "isError" | "isFetching" | "isLoading"
  >,
): HistoryRenderState {
  if (timeline.history !== undefined) {
    return "ready";
  }
  if (timeline.isError) {
    return "unavailable";
  }
  if (timeline.isLoading || timeline.isFetching || !timeline.isError) {
    return "loading";
  }
  return "unavailable";
}

function renderHistoryByState(state: HistoryRenderState): React.JSX.Element {
  if (state === "loading") {
    return renderHistoryLoading();
  }
  return renderHistoryUnavailable();
}

function olderStatusLabel(
  timeline: Pick<
    ReturnType<typeof useSessionTimeline>,
    "isFetchingOlder" | "isOlderError"
  >,
): string | null {
  if (timeline.isFetchingOlder) {
    return "Loading older messages";
  }
  if (timeline.isOlderError) {
    return "Failed to load older messages";
  }
  return null;
}

function renderReadyHistory(
  timeline: Pick<
    ReturnType<typeof useSessionTimeline>,
    "history" | "isFetchingOlder" | "isOlderError"
  >,
  onLoadOlder: () => void,
  openSessionId: string,
): React.JSX.Element {
  if (timeline.history === undefined) {
    return renderHistoryUnavailable();
  }
  const statusLabel = olderStatusLabel(timeline);

  return (
    <Box flex={1} style={historyRootStyle}>
      <SessionHistoryList
        isFetchingOlder={timeline.isFetchingOlder}
        history={timeline.history}
        onLoadOlder={onLoadOlder}
        openSessionId={openSessionId}
      />
      {statusLabel !== null && (
        <Box pointerEvents="none" style={historyOverlayStyle}>
          <Text variant={historyStatusVariant}>{statusLabel}</Text>
        </Box>
      )}
    </Box>
  );
}

function selectedOpenSessionId(
  activeSession: ActiveSession | null,
): string | null {
  if (activeSession?.kind !== "open") {
    return null;
  }
  return activeSession.openSessionId;
}

function renderSessionHistory(args: {
  activeSession: ActiveSession | null;
  onLoadOlder: () => void;
  openSessionId: string | null;
  timeline: ReturnType<typeof useSessionTimeline>;
}): React.JSX.Element {
  if (args.activeSession === null || args.openSessionId === null) {
    return renderNoActiveSession();
  }
  const state = historyRenderState(args.timeline);
  if (state !== "ready" || args.timeline.history === undefined) {
    return renderHistoryByState(state);
  }
  return renderReadyHistory(
    args.timeline,
    args.onLoadOlder,
    args.openSessionId,
  );
}

function SessionHistory(): React.JSX.Element {
  const activeSession = useSelector(selectActiveSession);
  const openSessionId = selectedOpenSessionId(activeSession);
  const timeline = useSessionTimeline(openSessionId);
  const [loadOlder] = useLoadOlderSessionTimelineMutation();
  const handleLoadOlder = useCallback((): void => {
    if (openSessionId === null || timeline.history === undefined) {
      return;
    }
    if (timeline.isFetchingOlder) {
      return;
    }
    const cursor = timeline.history.nextCursor;
    if (cursor === null) {
      return;
    }
    void loadOlder({
      cursor,
      openSessionId,
    });
  }, [loadOlder, openSessionId, timeline.history, timeline.isFetchingOlder]);

  return renderSessionHistory({
    activeSession,
    onLoadOlder: handleLoadOlder,
    openSessionId,
    timeline,
  });
}

export { SessionHistory };
