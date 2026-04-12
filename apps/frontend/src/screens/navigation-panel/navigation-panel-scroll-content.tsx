import { ScrollArea } from "@/ui";
import { NavigationPanelRows } from "./navigation-panel-rows";

interface NavigationPanelScrollContentProps {
  onSessionSelected?: (() => void) | undefined;
}

function NavigationPanelScrollContent({
  onSessionSelected,
}: NavigationPanelScrollContentProps): React.JSX.Element {
  return (
    <ScrollArea>
      <NavigationPanelRows onSessionSelected={onSessionSelected} />
    </ScrollArea>
  );
}

export { NavigationPanelScrollContent };
