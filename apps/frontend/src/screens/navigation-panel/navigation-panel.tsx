import { PanelHost } from "@/ui";
import { NavigationPanelContent } from "./navigation-panel-content";

function NavigationPanelScreen(): React.JSX.Element {
  return (
    <PanelHost>
      <NavigationPanelContent />
    </PanelHost>
  );
}

export { NavigationPanelScreen };
