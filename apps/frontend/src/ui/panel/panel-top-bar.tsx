import { View } from "react-native";
import { IconSlot } from "@/ui/icon-slot";
import { panelStyles } from "./panel.styles";

interface PanelTopBarProps {
  icons: string[];
}

function PanelTopBar({ icons }: PanelTopBarProps): React.JSX.Element {
  return (
    <View style={panelStyles.topBar}>
      {icons.map((icon) => (
        <IconSlot key={icon} mark={icon} />
      ))}
    </View>
  );
}

export { PanelTopBar };
