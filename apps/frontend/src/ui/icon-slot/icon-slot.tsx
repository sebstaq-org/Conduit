import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";
import { panelTokens } from "@/ui/tokens";
import { iconSlotStyles } from "./icon-slot.styles";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];
type MaterialCommunityIconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

type IconSlotName =
  | FeatherIconName
  | { family: "material-community"; name: MaterialCommunityIconName };

interface IconSlotProps {
  name: IconSlotName;
}

function IconSlot({ name }: IconSlotProps): React.JSX.Element {
  if (typeof name !== "string") {
    return (
      <View style={iconSlotStyles.icon}>
        <MaterialCommunityIcons
          color={panelTokens.colors.icon}
          name={name.name}
          size={panelTokens.sizes.iconGlyph}
        />
      </View>
    );
  }

  return (
    <View style={iconSlotStyles.icon}>
      <Feather
        color={panelTokens.colors.icon}
        name={name}
        size={panelTokens.sizes.iconGlyph}
      />
    </View>
  );
}

export { IconSlot };

export type { IconSlotName };
