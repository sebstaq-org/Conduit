import { PanelBody } from "@/ui";
import type { SessionListTarget } from "@/features/session-list/session-list-target";
import { NavigationPanelScrollContent } from "./navigation-panel-scroll-content";
import { NavigationPanelSettings } from "./navigation-panel-settings";

interface NavigationPanelContentProps {
  onSessionTargetSelected?: ((target: SessionListTarget) => void) | undefined;
}

function NavigationPanelContent({
  onSessionTargetSelected,
}: NavigationPanelContentProps): React.JSX.Element {
  return (
    <PanelBody>
      <NavigationPanelScrollContent
        onSessionTargetSelected={onSessionTargetSelected}
      />
      <NavigationPanelSettings />
    </PanelBody>
  );
}

export { NavigationPanelContent };
