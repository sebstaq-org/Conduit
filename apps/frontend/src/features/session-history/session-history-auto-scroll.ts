import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type {
  ScrollAreaContentSize,
  ScrollAreaHandle,
  ScrollAreaMetrics,
} from "@/ui";
interface SessionHistoryAutoScroll {
  onContentSizeChange: (size: ScrollAreaContentSize) => void;
  onMetricsChange: (metrics: ScrollAreaMetrics) => void;
  scrollAreaRef: RefObject<ScrollAreaHandle | null>;
}
interface SessionHistoryAutoScrollInput {
  activeOpenSessionId: string | null;
  isFetchingOlder: boolean;
  loadOlder: () => void;
  nextOlderCursor: string | null;
}
interface PrependAnchor {
  contentHeight: number;
  offsetY: number;
}
interface SessionTrackingRefs {
  scrollAreaRef: RefObject<ScrollAreaHandle | null>;
  isNearBottomRef: RefObject<boolean>;
  latestMetricsRef: RefObject<ScrollAreaMetrics | null>;
  prependAnchorRef: RefObject<PrependAnchor | null>;
  shouldSnapToBottomRef: RefObject<boolean>;
  trackedSessionIdRef: RefObject<string | null>;
}
interface SessionHistoryAutoScrollHandlerInput {
  isFetchingOlder: boolean;
  loadOlder: () => void;
  nextOlderCursor: string | null;
  refs: SessionTrackingRefs;
}
interface OlderWindowRequestInput {
  isFetchingOlder: boolean;
  loadOlder: () => void;
  metrics: ScrollAreaMetrics;
  nextOlderCursor: string | null;
  prependAnchorRef: RefObject<PrependAnchor | null>;
}
interface PrependAnchorCompensationInput {
  isFetchingOlder: boolean;
  prependAnchorRef: RefObject<PrependAnchor | null>;
  scrollAreaRef: RefObject<ScrollAreaHandle | null>;
  size: ScrollAreaContentSize;
}
const historyAutoScrollThreshold = 48;
const historyTopPrefetchMinimumDistance = 480;
const historyTopPrefetchViewportMultiplier = 2;
function nearHistoryBottom(metrics: ScrollAreaMetrics): boolean {
  return metrics.distanceFromBottom <= historyAutoScrollThreshold;
}
function nearHistoryTop(metrics: ScrollAreaMetrics): boolean {
  const threshold = Math.max(
    metrics.viewportHeight * historyTopPrefetchViewportMultiplier,
    historyTopPrefetchMinimumDistance,
  );
  return metrics.offsetY <= threshold;
}
function syncTrackedSession(
  activeOpenSessionId: string | null,
  refs: SessionTrackingRefs,
): void {
  if (refs.trackedSessionIdRef.current === activeOpenSessionId) {
    return;
  }
  refs.trackedSessionIdRef.current = activeOpenSessionId;
  refs.shouldSnapToBottomRef.current = activeOpenSessionId !== null;
  refs.isNearBottomRef.current = true;
  refs.latestMetricsRef.current = null;
  refs.prependAnchorRef.current = null;
}
function shouldReleaseStaleAnchor(
  contentHeight: number,
  isFetchingOlder: boolean,
  prependAnchorRef: RefObject<PrependAnchor | null>,
): boolean {
  if (isFetchingOlder || prependAnchorRef.current === null) {
    return false;
  }
  if (contentHeight > prependAnchorRef.current.contentHeight) {
    return false;
  }
  prependAnchorRef.current = null;
  return true;
}
function tryRequestOlderWindow({
  isFetchingOlder,
  loadOlder,
  metrics,
  nextOlderCursor,
  prependAnchorRef,
}: OlderWindowRequestInput): void {
  if (
    nextOlderCursor === null ||
    isFetchingOlder ||
    prependAnchorRef.current !== null ||
    !nearHistoryTop(metrics)
  ) {
    return;
  }
  prependAnchorRef.current = {
    contentHeight: metrics.contentHeight,
    offsetY: metrics.offsetY,
  };
  loadOlder();
}
function updateMetricSnapshot(
  latestMetricsRef: RefObject<ScrollAreaMetrics | null>,
  size: ScrollAreaContentSize,
): ScrollAreaMetrics | null {
  if (latestMetricsRef.current === null) {
    return null;
  }
  latestMetricsRef.current.contentHeight = size.height;
  latestMetricsRef.current.contentWidth = size.width;
  return latestMetricsRef.current;
}
function applyPrependAnchorCompensation({
  isFetchingOlder,
  prependAnchorRef,
  scrollAreaRef,
  size,
}: PrependAnchorCompensationInput): boolean {
  if (prependAnchorRef.current === null) {
    return false;
  }
  const delta = size.height - prependAnchorRef.current.contentHeight;
  if (delta > 0) {
    scrollAreaRef.current?.scrollToOffset({
      animated: false,
      offsetY: prependAnchorRef.current.offsetY + delta,
    });
    prependAnchorRef.current = null;
    return true;
  }
  if (!isFetchingOlder) {
    prependAnchorRef.current = null;
  }
  return false;
}
function tryScrollToBottom(
  isNearBottomRef: RefObject<boolean>,
  scrollAreaRef: RefObject<ScrollAreaHandle | null>,
  shouldSnapToBottomRef: RefObject<boolean>,
): boolean {
  if (shouldSnapToBottomRef.current) {
    scrollAreaRef.current?.scrollToEnd({ animated: false });
    shouldSnapToBottomRef.current = false;
    return true;
  }
  if (!isNearBottomRef.current) {
    return false;
  }
  scrollAreaRef.current?.scrollToEnd({ animated: true });
  return true;
}
function useSessionTrackingRefs(
  activeOpenSessionId: string | null,
): SessionTrackingRefs {
  const scrollAreaRef = useRef<ScrollAreaHandle | null>(null);
  const isNearBottomRef = useRef(true);
  const latestMetricsRef = useRef<ScrollAreaMetrics | null>(null);
  const prependAnchorRef = useRef<PrependAnchor | null>(null);
  const shouldSnapToBottomRef = useRef(activeOpenSessionId !== null);
  const trackedSessionIdRef = useRef(activeOpenSessionId);
  syncTrackedSession(activeOpenSessionId, {
    scrollAreaRef,
    isNearBottomRef,
    latestMetricsRef,
    prependAnchorRef,
    shouldSnapToBottomRef,
    trackedSessionIdRef,
  });
  return {
    scrollAreaRef,
    isNearBottomRef,
    latestMetricsRef,
    prependAnchorRef,
    shouldSnapToBottomRef,
    trackedSessionIdRef,
  };
}
function useMetricsChangeHandler({
  isFetchingOlder,
  loadOlder,
  nextOlderCursor,
  refs,
}: SessionHistoryAutoScrollHandlerInput): (
  metrics: ScrollAreaMetrics,
) => void {
  return useCallback(
    (metrics: ScrollAreaMetrics): void => {
      refs.latestMetricsRef.current = metrics;
      refs.isNearBottomRef.current = nearHistoryBottom(metrics);
      if (
        shouldReleaseStaleAnchor(
          metrics.contentHeight,
          isFetchingOlder,
          refs.prependAnchorRef,
        )
      ) {
        return;
      }
      tryRequestOlderWindow(
        {
          isFetchingOlder,
          loadOlder,
          metrics,
          nextOlderCursor,
          prependAnchorRef: refs.prependAnchorRef,
        },
      );
    },
    [isFetchingOlder, loadOlder, nextOlderCursor, refs],
  );
}
function useContentSizeChangeHandler({
  isFetchingOlder,
  loadOlder,
  nextOlderCursor,
  refs,
}: SessionHistoryAutoScrollHandlerInput): (
  size: ScrollAreaContentSize,
) => void {
  return useCallback(
    (size: ScrollAreaContentSize): void => {
      const metrics = updateMetricSnapshot(refs.latestMetricsRef, size);
      if (
        applyPrependAnchorCompensation(
          {
            isFetchingOlder,
            prependAnchorRef: refs.prependAnchorRef,
            scrollAreaRef: refs.scrollAreaRef,
            size,
          },
        )
      ) {
        return;
      }
      if (
        tryScrollToBottom(
          refs.isNearBottomRef,
          refs.scrollAreaRef,
          refs.shouldSnapToBottomRef,
        )
      ) {
        return;
      }
      if (metrics === null) {
        return;
      }
      tryRequestOlderWindow(
        {
          isFetchingOlder,
          loadOlder,
          metrics,
          nextOlderCursor,
          prependAnchorRef: refs.prependAnchorRef,
        },
      );
    },
    [isFetchingOlder, loadOlder, nextOlderCursor, refs],
  );
}
function useSessionHistoryAutoScrollHandlers({
  activeOpenSessionId,
  isFetchingOlder,
  loadOlder,
  nextOlderCursor,
}: SessionHistoryAutoScrollInput): SessionHistoryAutoScroll {
  const refs = useSessionTrackingRefs(activeOpenSessionId);
  const handlerInput = {
    isFetchingOlder,
    loadOlder,
    nextOlderCursor,
    refs,
  };
  const onMetricsChange = useMetricsChangeHandler(handlerInput);
  const onContentSizeChange = useContentSizeChangeHandler(handlerInput);
  return {
    onContentSizeChange,
    onMetricsChange,
    scrollAreaRef: refs.scrollAreaRef,
  };
}
function useSessionHistoryAutoScroll(
  input: SessionHistoryAutoScrollInput,
): SessionHistoryAutoScroll {
  return useSessionHistoryAutoScrollHandlers(input);
}
export { useSessionHistoryAutoScroll };
