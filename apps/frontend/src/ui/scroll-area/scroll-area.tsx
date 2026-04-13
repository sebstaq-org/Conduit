import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { useTheme } from "@shopify/restyle";
import { ScrollView } from "react-native";
import type { ForwardedRef, ReactNode, RefObject } from "react";
import type { LayoutChangeEvent, NativeScrollEvent } from "react-native";
import type { Theme } from "@/theme";
import {
  createScrollAreaContentStyle,
  scrollAreaStyle,
} from "./scroll-area.styles";

interface ScrollAreaContentSize {
  height: number;
  width: number;
}

interface ScrollAreaMetrics {
  contentHeight: number;
  contentWidth: number;
  distanceFromBottom: number;
  offsetY: number;
  viewportHeight: number;
}

interface ScrollAreaHandle {
  scrollToEnd: (options?: { animated?: boolean }) => void;
}

interface ScrollAreaProps {
  children: ReactNode;
  onContentSizeChange?:
    | ((size: ScrollAreaContentSize) => void)
    | undefined;
  onMetricsChange?: ((metrics: ScrollAreaMetrics) => void) | undefined;
}

const defaultScrollEventThrottle = 16;

interface ScrollAreaMetricState {
  contentHeightRef: RefObject<number>;
  contentWidthRef: RefObject<number>;
  offsetYRef: RefObject<number>;
  viewportHeightRef: RefObject<number>;
}

function useScrollAreaMetricState(): ScrollAreaMetricState {
  return {
    contentHeightRef: useRef(0),
    contentWidthRef: useRef(0),
    offsetYRef: useRef(0),
    viewportHeightRef: useRef(0),
  };
}

function metricSnapshot(state: ScrollAreaMetricState): ScrollAreaMetrics {
  const contentHeight = state.contentHeightRef.current ?? 0;
  const viewportHeight = state.viewportHeightRef.current ?? 0;
  const offsetY = state.offsetYRef.current ?? 0;

  return {
    contentHeight,
    contentWidth: state.contentWidthRef.current ?? 0,
    distanceFromBottom: contentHeight - (offsetY + viewportHeight),
    offsetY,
    viewportHeight,
  };
}

function emitMetrics(
  state: ScrollAreaMetricState,
  onMetricsChange: ((metrics: ScrollAreaMetrics) => void) | undefined,
): void {
  onMetricsChange?.(metricSnapshot(state));
}

function applyContentSize(
  state: ScrollAreaMetricState,
  width: number,
  height: number,
): void {
  state.contentHeightRef.current = height;
  state.contentWidthRef.current = width;
}

function applyLayout(
  state: ScrollAreaMetricState,
  event: LayoutChangeEvent,
): void {
  state.viewportHeightRef.current = event.nativeEvent.layout.height;
}

function applyScroll(state: ScrollAreaMetricState, event: NativeScrollEvent): void {
  state.contentHeightRef.current = event.contentSize.height;
  state.contentWidthRef.current = event.contentSize.width;
  state.offsetYRef.current = event.contentOffset.y;
  state.viewportHeightRef.current = event.layoutMeasurement.height;
}

interface ScrollAreaHandlers {
  handleContentSizeChange: (width: number, height: number) => void;
  handleLayout: (event: LayoutChangeEvent) => void;
  handleScroll: (event: NativeScrollEvent) => void;
}

function useScrollAreaHandlers(
  state: ScrollAreaMetricState,
  onContentSizeChange: ((size: ScrollAreaContentSize) => void) | undefined,
  onMetricsChange: ((metrics: ScrollAreaMetrics) => void) | undefined,
): ScrollAreaHandlers {
  const handleContentSizeChange = useCallback(
    (width: number, height: number): void => {
      applyContentSize(state, width, height);
      onContentSizeChange?.({ height, width });
      emitMetrics(state, onMetricsChange);
    },
    [onContentSizeChange, onMetricsChange, state],
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent): void => {
      applyLayout(state, event);
      emitMetrics(state, onMetricsChange);
    },
    [onMetricsChange, state],
  );
  const handleScroll = useCallback(
    (event: NativeScrollEvent): void => {
      applyScroll(state, event);
      emitMetrics(state, onMetricsChange);
    },
    [onMetricsChange, state],
  );
  return { handleContentSizeChange, handleLayout, handleScroll };
}

function useScrollAreaHandle(
  ref: ForwardedRef<ScrollAreaHandle>,
  scrollViewRef: RefObject<ScrollView | null>,
): void {
  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: ({ animated = true } = {}): void => {
        scrollViewRef.current?.scrollToEnd({ animated });
      },
    }),
    [scrollViewRef],
  );
}

const ScrollArea = forwardRef<ScrollAreaHandle, ScrollAreaProps>(function ScrollArea(
  { children, onContentSizeChange, onMetricsChange }: ScrollAreaProps,
  ref,
): React.JSX.Element {
  const theme = useTheme<Theme>();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const state = useScrollAreaMetricState();
  const handlers = useScrollAreaHandlers(
    state,
    onContentSizeChange,
    onMetricsChange,
  );
  useScrollAreaHandle(ref, scrollViewRef);

  return (
    <ScrollView
      contentContainerStyle={createScrollAreaContentStyle(theme)}
      onContentSizeChange={handlers.handleContentSizeChange}
      onLayout={handlers.handleLayout}
      onScroll={(event): void => {
        handlers.handleScroll(event.nativeEvent);
      }}
      ref={scrollViewRef}
      scrollEventThrottle={defaultScrollEventThrottle}
      showsVerticalScrollIndicator={false}
      style={scrollAreaStyle}
    >
      {children}
    </ScrollView>
  );
});

export { ScrollArea };
export type { ScrollAreaContentSize, ScrollAreaHandle, ScrollAreaMetrics };
