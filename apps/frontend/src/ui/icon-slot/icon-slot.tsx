import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@shopify/restyle";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { createIconSlotFrameStyle, iconSlotMetrics } from "./icon-slot.styles";

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
  const theme = useTheme<Theme>();
  const metrics = iconSlotMetrics(theme);
  const frameStyle = createIconSlotFrameStyle(theme);

  if (typeof name !== "string") {
    return (
      <Box style={frameStyle}>
        <MaterialCommunityIcons
          color={metrics.color}
          name={name.name}
          size={metrics.glyphSize}
        />
      </Box>
    );
  }

  return (
    <Box style={frameStyle}>
      <Feather color={metrics.color} name={name} size={metrics.glyphSize} />
    </Box>
  );
}

export { IconSlot };

export type { IconSlotName };
