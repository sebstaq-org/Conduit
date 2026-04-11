import { Text } from "@/theme";
import {
  navigationPanelHeadingMarginBottom,
  navigationPanelHeadingVariant,
} from "./navigation-panel.styles";
import { NavigationPanelProjectRows } from "./navigation-panel-project-rows";
import { NavigationPanelThreadSection } from "./navigation-panel-thread-section";

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
      <NavigationPanelThreadSection />
    </>
  );
}

export { NavigationPanelRows };
