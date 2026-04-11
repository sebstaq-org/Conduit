import { SessionList } from "@/features/session-list";
import { Text } from "@/theme";
import {
  navigationPanelHeadingMarginBottom,
  navigationPanelHeadingVariant,
} from "./navigation-panel.styles";
import { NavigationPanelProjectRows } from "./navigation-panel-project-rows";

function NavigationPanelRows(): React.JSX.Element {
  return (
    <>
      <Text
        mb={navigationPanelHeadingMarginBottom}
        variant={navigationPanelHeadingVariant}
      >
        Conduit
      </Text>
      <NavigationPanelProjectRows />
      <SessionList />
    </>
  );
}

export { NavigationPanelRows };
