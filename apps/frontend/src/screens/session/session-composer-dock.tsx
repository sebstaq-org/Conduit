import { selectActiveSession, usePlanInteractionSource } from "@/app-state";
import { SessionComposer } from "@/features/session-composer";
import { useTheme } from "@shopify/restyle";
import { KeyboardDock } from "@/ui";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme";
import { createSessionComposerDockStyle } from "./session.styles";
import { shouldRenderSessionComposerDock } from "./session-composer-dock.contract";

interface SessionComposerDockProps {
  onHeightChange: (height: number) => void;
}

function SessionComposerDock({
  onHeightChange,
}: SessionComposerDockProps): React.JSX.Element | null {
  const activeSession = useSelector(selectActiveSession);
  const planInteraction = usePlanInteractionSource();
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme<Theme>();

  if (!shouldRenderSessionComposerDock(activeSession, planInteraction)) {
    return null;
  }

  return (
    <KeyboardDock
      contentStyle={createSessionComposerDockStyle(
        theme,
        safeAreaInsets.bottom,
      )}
      onLayout={(event) => {
        onHeightChange(event.nativeEvent.layout.height);
      }}
    >
      <SessionComposer planInteraction={planInteraction} />
    </KeyboardDock>
  );
}

export { SessionComposerDock };
