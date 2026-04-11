import { Text } from "react-native";
import { NavigationPanelProjectRows } from "./navigation-panel-project-rows";
import { NavigationPanelThreadSection } from "./navigation-panel-thread-section";
import { navigationPanelStyles } from "./navigation-panel.styles";

function NavigationPanelRows(): React.JSX.Element {
  return (
    <>
      <Text style={navigationPanelStyles.heading}>Conduit</Text>
      <NavigationPanelProjectRows />
      <NavigationPanelThreadSection />
    </>
  );
}

export { NavigationPanelRows };
