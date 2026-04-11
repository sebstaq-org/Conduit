import { View } from "react-native";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { panelStyles } from "./panel.styles";

interface PanelTopBarProps {
  icons: IconSlotName[];
}

function getIconSlotKey(name: IconSlotName): string {
  if (typeof name === "string") {
    return name;
  }

  return `${name.family}:${name.name}`;
}

function PanelTopBar({ icons }: PanelTopBarProps): React.JSX.Element {
  return (
    <View style={panelStyles.topBar}>
      {icons.map((icon) => (
        <IconSlot key={getIconSlotKey(icon)} name={icon} />
      ))}
    </View>
  );
}

export { PanelTopBar };
