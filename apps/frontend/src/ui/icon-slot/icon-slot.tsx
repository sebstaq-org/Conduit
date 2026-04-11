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
  color?: keyof Theme["colors"] | undefined;
  name: IconSlotName;
}

function resolveIconColor(
  theme: Theme,
  metrics: ReturnType<typeof iconSlotMetrics>,
  color: keyof Theme["colors"] | undefined,
): string {
  if (color === undefined) {
    return metrics.color;
  }

  return theme.colors[color];
}

function IconSlot({ color, name }: IconSlotProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const metrics = iconSlotMetrics(theme);
  const frameStyle = createIconSlotFrameStyle(theme);
  const iconColor = resolveIconColor(theme, metrics, color);

  if (typeof name !== "string") {
    return (
      <Box style={frameStyle}>
        <MaterialCommunityIcons
          color={iconColor}
          name={name.name}
          size={metrics.glyphSize}
        />
      </Box>
    );
  }

  return (
    <Box style={frameStyle}>
      <Feather color={iconColor} name={name} size={metrics.glyphSize} />
    </Box>
  );
}

export { IconSlot };

export type { IconSlotName };
