import { SessionList } from "@/features/session-list";
import { Text } from "@/theme";
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
      <SessionList onSessionSelected={onSessionSelected} />
    </>
  );
}

export { NavigationPanelRows };
