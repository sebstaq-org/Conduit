import { HostPairingPanel } from "@/features/host-pairing";
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
  switch (row.kind) {
    case "heading": {
      return (
        <Text
          mb={navigationPanelHeadingMarginBottom}
          variant={navigationPanelHeadingVariant}
        >
          Conduit
        </Text>
      );
    }
    case "projectRows": {
      return <NavigationPanelProjectRows />;
    }
    case "hostPairing": {
      return <HostPairingPanel />;
    }
    case "threadsHeader": {
      return (
        <Section actions={<ProjectsToolbar />} title="Threads">
          <Box />
        </Section>
      );
    }
    case "status": {
      return <Row label={row.label} meta={row.meta} muted />;
    }
    case "groupEmpty":
    case "groupHeader":
    case "session": {
      return null;
    }
    default: {
      return null;
    }
  }
}

export { renderStaticNavigationPanelRow };
