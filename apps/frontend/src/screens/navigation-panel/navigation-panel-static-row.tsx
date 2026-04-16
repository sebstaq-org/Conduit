import { ProjectsToolbar } from "@/features/projects-toolbar";
import { Box, Text } from "@/theme";
import { Row, Section } from "@/ui";
import {
  navigationPanelHeadingMarginBottom,
  navigationPanelHeadingVariant,
} from "./navigation-panel.styles";
import { NavigationPanelProjectRows } from "./navigation-panel-project-rows";
import type { NavigationPanelScrollRow } from "./navigation-panel-scroll-rows";

function renderStaticNavigationPanelRow(
  row: NavigationPanelScrollRow,
): React.JSX.Element | null {
  if (row.kind === "heading") {
    return (
      <Text
        mb={navigationPanelHeadingMarginBottom}
        variant={navigationPanelHeadingVariant}
      >
        Conduit
      </Text>
    );
  }
  if (row.kind === "projectRows") {
    return <NavigationPanelProjectRows />;
  }
  if (row.kind === "threadsHeader") {
    return (
      <Section actions={<ProjectsToolbar />} title="Threads">
        <Box />
      </Section>
    );
  }
  if (row.kind === "status") {
    return <Row label={row.label} meta={row.meta} muted />;
  }
  return null;
}

export { renderStaticNavigationPanelRow };
