import { ScrollArea } from "@/ui";
import { NavigationPanelRows } from "./navigation-panel-rows";

function NavigationPanelScrollContent(): React.JSX.Element {
  return (
    <ScrollArea>
      <NavigationPanelRows />
    </ScrollArea>
  );
}

export { NavigationPanelScrollContent };
