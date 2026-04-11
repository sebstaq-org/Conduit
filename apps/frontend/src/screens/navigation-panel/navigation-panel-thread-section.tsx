import { Section } from "@/ui";
import { NavigationPanelThreadActions } from "./navigation-panel-thread-actions";
import { NavigationPanelThreadRows } from "./navigation-panel-thread-rows";

function NavigationPanelThreadSection(): React.JSX.Element {
  return (
    <Section actions={<NavigationPanelThreadActions />} title="Threads">
      <NavigationPanelThreadRows />
    </Section>
  );
}

export { NavigationPanelThreadSection };
