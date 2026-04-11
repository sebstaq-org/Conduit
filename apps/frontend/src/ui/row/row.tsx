import type { ReactNode } from "react";
import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { Meta } from "@/ui/meta";
import {
  createRowIndentStyle,
  rowAlignItems,
  rowBorderRadius,
  rowFlexDirection,
  rowGap,
  rowLabelNumberOfLines,
  rowLabelVariant,
  rowMinHeight,
  rowPaddingHorizontal,
} from "./row.styles";

interface RowProps {
  depth?: number;
  icon?: IconSlotName | undefined;
  label: string;
  meta?: string | undefined;
  muted?: boolean | undefined;
  trailing?: ReactNode | undefined;
}

function Row({
  depth = 0,
  icon,
  label,
  meta,
  muted = false,
  trailing,
}: RowProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Box
      alignItems={rowAlignItems}
      borderRadius={rowBorderRadius}
      flexDirection={rowFlexDirection}
      gap={rowGap}
      minHeight={rowMinHeight(theme)}
      px={rowPaddingHorizontal}
      style={createRowIndentStyle(theme, depth)}
    >
      {icon !== undefined && <IconSlot name={icon} />}
      <Text
        numberOfLines={rowLabelNumberOfLines}
        variant={rowLabelVariant(muted)}
      >
        {label}
      </Text>
      {meta !== undefined && <Meta>{meta}</Meta>}
      {trailing}
    </Box>
  );
}

export { Row };
