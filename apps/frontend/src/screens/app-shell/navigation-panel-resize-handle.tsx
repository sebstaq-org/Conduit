import { useTheme } from "@shopify/restyle";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import {
  createNavigationPanelResizeHandleLineStyle,
  createNavigationPanelResizeHandleStyle,
} from "./app-shell.styles";

interface NavigationPanelResizeHandleProps {
  maxWidth: number;
  minWidth: number;
  onWidthChange: (width: number) => void;
  width: number;
}

function NavigationPanelResizeHandle({
  maxWidth,
  minWidth,
  onWidthChange,
  width,
}: NavigationPanelResizeHandleProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const dragStartWidth = useSharedValue(width);
  const createPanGesture = Gesture.Pan;

  const resizeGesture = createPanGesture()
    .activeCursor("col-resize")
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      dragStartWidth.value = width;
    })
    .onUpdate((event) => {
      const nextWidth = Math.min(
        Math.max(dragStartWidth.value + event.translationX, minWidth),
        maxWidth,
      );

      scheduleOnRN(onWidthChange, nextWidth);
    });

  return (
    <GestureDetector gesture={resizeGesture}>
      <Box
        accessibilityLabel="Resize navigation panel"
        accessible
        style={createNavigationPanelResizeHandleStyle(theme)}
      >
        <Box style={createNavigationPanelResizeHandleLineStyle(theme)} />
      </Box>
    </GestureDetector>
  );
}

export { NavigationPanelResizeHandle };
