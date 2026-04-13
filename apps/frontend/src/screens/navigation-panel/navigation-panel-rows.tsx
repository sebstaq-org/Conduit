import { ProjectsToolbar } from "@/features/projects-toolbar";
import { RuntimeStatusPanel } from "@/features/runtime-status";
import { SessionList } from "@/features/session-list";
import { Text } from "@/theme";
import { Section } from "@/ui";
import {
  navigationPanelHeadingMarginBottom,
  navigationPanelHeadingVariant,
} from "./navigation-panel.styles";
import { NavigationPanelProjectRows } from "./navigation-panel-project-rows";

interface NavigationPanelRowsProps {
  onSessionSelected?: (() => void) | undefined;
}

function NavigationPanelRows({
  onSessionSelected,
}: NavigationPanelRowsProps): React.JSX.Element {
  return (
    <>
      <Text
        mb={navigationPanelHeadingMarginBottom}
        variant={navigationPanelHeadingVariant}
      >
        Conduit
      </Text>
      <NavigationPanelProjectRows />
      <RuntimeStatusPanel />
      <Section actions={<ProjectsToolbar />} title="Threads">
        <SessionList onSessionSelected={onSessionSelected} />
      </Section>
    </>
  );
}

export { NavigationPanelRows };
