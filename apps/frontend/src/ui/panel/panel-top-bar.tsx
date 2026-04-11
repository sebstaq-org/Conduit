import { useTheme } from "@shopify/restyle";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import {
  panelTopBarAlignItems,
  panelTopBarFlexDirection,
  panelTopBarGap,
  panelTopBarHeight,
  panelTopBarPaddingTop,
  panelTopBarPaddingX,
} from "./panel.styles";

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
  const theme = useTheme<Theme>();

  return (
    <Box
      alignItems={panelTopBarAlignItems}
      flexDirection={panelTopBarFlexDirection}
      gap={panelTopBarGap}
      height={panelTopBarHeight(theme)}
      px={panelTopBarPaddingX}
      pt={panelTopBarPaddingTop}
    >
      {icons.map((icon) => (
        <IconSlot key={getIconSlotKey(icon)} name={icon} />
      ))}
    </Box>
  );
}

export { PanelTopBar };
