import { ProjectsToolbar } from "@/features/projects-toolbar";
import { Box } from "@/theme";
import { Row, Section } from "@/ui";
import { NavigationPanelHeader } from "./navigation-panel-header";
import { NavigationPanelProjectRows } from "./navigation-panel-project-rows";
import type { NavigationPanelScrollRow } from "./navigation-panel-scroll-rows";

function renderStaticNavigationPanelRow(
  row: NavigationPanelScrollRow,
): React.JSX.Element | null {
  switch (row.kind) {
    case "heading": {
      return <NavigationPanelHeader />;
    }
    case "projectRows": {
      return <NavigationPanelProjectRows />;
    }
    case "projectsHeader": {
      return (
        <Section actions={<ProjectsToolbar />} title="Projects">
          <Box />
        </Section>
      );
    }
    case "status": {
      return <Row label={row.label} meta={row.meta} muted />;
    }
    case "groupEmpty":
    case "groupHeader":
    case "draftSession":
    case "session": {
      return null;
    }
    default: {
      return null;
    }
  }
}

export { renderStaticNavigationPanelRow };
