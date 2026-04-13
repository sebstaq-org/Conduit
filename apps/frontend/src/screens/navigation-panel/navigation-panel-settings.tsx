import { SessionHistorySettingsControl } from "@/features/settings";
import { PanelFooter } from "@/ui";

function NavigationPanelSettings(): React.JSX.Element {
  return (
    <PanelFooter>
      <SessionHistorySettingsControl />
    </PanelFooter>
  );
}

export { NavigationPanelSettings };
