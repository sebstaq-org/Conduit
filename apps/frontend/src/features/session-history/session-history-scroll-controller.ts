import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

interface SessionHistoryScrollControllerArgs<Row> {
  hasOlder: boolean;
  isFetchingOlder: boolean;
  onLoadOlder: () => void;
  openSessionId: string;
  olderCursor: string | null;
  revision: number;
}

interface SessionHistoryScrollController<Row> {
  contentViewportStyle: { flex: 1; minHeight: 0 };
  listRef: RefObject<FlatList<Row> | null>;
  maintainVisibleContentPosition: {
    autoscrollToTopThreshold: number;
    minIndexForVisible: number;
  };
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

interface ScrollMetrics {
  contentHeight: number;
  offsetY: number;
  viewportHeight: number;
}

const historyViewportStyle = { flex: 1, minHeight: 0 } as const;
const historyBottomThresholdPx = 48;
const historyPrefetchThresholdMinPx = 480;
const historyPrefetchThresholdViewportMultiplier = 1.5;
const historyPrefetchResetMultiplier = 2;
const historyScrollEventThrottle = 16;

function topPrefetchThreshold(metrics: ScrollMetrics): number {
  return Math.max(
    historyPrefetchThresholdMinPx,
    metrics.viewportHeight * historyPrefetchThresholdViewportMultiplier,
  );
}

function distanceToHistoryTop(metrics: ScrollMetrics): number {
  return Math.max(
    0,
    metrics.contentHeight - metrics.viewportHeight - metrics.offsetY,
  );
}

function isNearHistoryBottom(metrics: ScrollMetrics): boolean {
  return metrics.offsetY <= historyBottomThresholdPx;
}

function createInitialScrollMetrics(): ScrollMetrics {
  return {
    contentHeight: 0,
    offsetY: 0,
    viewportHeight: 0,
  };
}

function useSessionHistoryScrollController<Row>({
  hasOlder,
  isFetchingOlder,
  onLoadOlder,
  openSessionId,
  olderCursor,
  revision,
}: SessionHistoryScrollControllerArgs<Row>): SessionHistoryScrollController<Row> {
  const listRef = useRef<FlatList<Row> | null>(null);
  const hasObservedHistoryScrollRef = useRef(false);
  const metricsRef = useRef<ScrollMetrics>(createInitialScrollMetrics());
  const lastOpenSessionIdRef = useRef<string | null>(null);
  const lastOlderCursorRef = useRef<string | null>(null);
  const lastRevisionRef = useRef<number | null>(null);
  const pendingSnapToLatestRef = useRef(true);
  const topPrefetchArmedRef = useRef(true);
  const maintainVisibleContentPosition = useMemo(
    () => ({
      autoscrollToTopThreshold: historyBottomThresholdPx,
      minIndexForVisible: 0,
    }),
    [],
  );

  const snapToLatest = useCallback((animated: boolean): void => {
    pendingSnapToLatestRef.current = false;
    listRef.current?.scrollToOffset({
      animated,
      offset: 0,
    });
  }, []);

  const flushPendingSnapToLatest = useCallback((): void => {
    const metrics = metricsRef.current;
    if (
      !pendingSnapToLatestRef.current ||
      metrics.contentHeight <= 0 ||
      metrics.viewportHeight <= 0
    ) {
      return;
    }
    snapToLatest(false);
  }, [snapToLatest]);

  useEffect(() => {
    if (lastOpenSessionIdRef.current === openSessionId) {
      return;
    }
    lastOpenSessionIdRef.current = openSessionId;
    lastRevisionRef.current = revision;
    pendingSnapToLatestRef.current = true;
    topPrefetchArmedRef.current = true;
    hasObservedHistoryScrollRef.current = false;
    metricsRef.current = createInitialScrollMetrics();
  }, [openSessionId, revision]);

  useEffect(() => {
    if (lastOlderCursorRef.current === olderCursor) {
      return;
    }
    lastOlderCursorRef.current = olderCursor;
    topPrefetchArmedRef.current = true;
  }, [olderCursor]);

  useEffect(() => {
    if (lastRevisionRef.current === null) {
      lastRevisionRef.current = revision;
      return;
    }
    if (lastRevisionRef.current === revision) {
      return;
    }
    lastRevisionRef.current = revision;
    if (isNearHistoryBottom(metricsRef.current)) {
      pendingSnapToLatestRef.current = true;
      flushPendingSnapToLatest();
    }
  }, [flushPendingSnapToLatest, revision]);

  const maybeLoadOlder = useCallback((): void => {
    if (!hasObservedHistoryScrollRef.current) {
      return;
    }
    const metrics = metricsRef.current;
    const threshold = topPrefetchThreshold(metrics);
    const distanceToTop = distanceToHistoryTop(metrics);

    if (distanceToTop > threshold * historyPrefetchResetMultiplier) {
      topPrefetchArmedRef.current = true;
      return;
    }
    if (!topPrefetchArmedRef.current || !hasOlder || isFetchingOlder) {
      return;
    }
    if (distanceToTop > threshold) {
      return;
    }
    topPrefetchArmedRef.current = false;
    onLoadOlder();
  }, [hasOlder, isFetchingOlder, onLoadOlder]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      metricsRef.current = {
        ...metricsRef.current,
        viewportHeight: event.nativeEvent.layout.height,
      };
      flushPendingSnapToLatest();
      maybeLoadOlder();
    },
    [flushPendingSnapToLatest, maybeLoadOlder],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number): void => {
      metricsRef.current = {
        ...metricsRef.current,
        contentHeight: height,
      };
      flushPendingSnapToLatest();
      maybeLoadOlder();
    },
    [flushPendingSnapToLatest, maybeLoadOlder],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      hasObservedHistoryScrollRef.current = true;
      metricsRef.current = {
        contentHeight: event.nativeEvent.contentSize.height,
        offsetY: event.nativeEvent.contentOffset.y,
        viewportHeight: event.nativeEvent.layoutMeasurement.height,
      };
      maybeLoadOlder();
    },
    [maybeLoadOlder],
  );

  return {
    contentViewportStyle: historyViewportStyle,
    listRef,
    maintainVisibleContentPosition,
    onContentSizeChange: handleContentSizeChange,
    onLayout: handleLayout,
    onScroll: handleScroll,
    scrollEventThrottle: historyScrollEventThrottle,
  };
}

export { useSessionHistoryScrollController };
export type { SessionHistoryScrollController };
