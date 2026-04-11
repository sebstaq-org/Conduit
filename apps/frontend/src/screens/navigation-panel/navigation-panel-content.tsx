import { PanelBody } from "@/ui";
import { NavigationPanelScrollContent } from "./navigation-panel-scroll-content";
import { NavigationPanelSettings } from "./navigation-panel-settings";

function NavigationPanelContent(): React.JSX.Element {
  return (
    <PanelBody>
      <NavigationPanelScrollContent />
      <NavigationPanelSettings />
    </PanelBody>
  );
}

export { NavigationPanelContent };
