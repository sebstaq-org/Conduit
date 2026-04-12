import { PanelBody } from "@/ui";
import { NavigationPanelScrollContent } from "./navigation-panel-scroll-content";
import { NavigationPanelSettings } from "./navigation-panel-settings";

interface NavigationPanelContentProps {
  onSessionSelected?: (() => void) | undefined;
}

function NavigationPanelContent({
  onSessionSelected,
}: NavigationPanelContentProps): React.JSX.Element {
  return (
    <PanelBody>
      <NavigationPanelScrollContent onSessionSelected={onSessionSelected} />
      <NavigationPanelSettings />
    </PanelBody>
  );
}

export { NavigationPanelContent };
