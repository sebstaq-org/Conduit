import { useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "@shopify/restyle";
import { Pressable } from "react-native";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { Meta } from "@/ui/meta";
import {
  createRowStyle,
  rowLabelNumberOfLines,
  rowLabelVariant,
} from "./row.styles";

interface RowProps {
  depth?: number;
  icon?: IconSlotName | undefined;
  label: string;
  meta?: string | undefined;
  muted?: boolean | undefined;
  onPress?: (() => void) | undefined;
  trailing?: ReactNode | undefined;
}

interface RowContentProps {
  icon?: IconSlotName | undefined;
  label: string;
  meta?: string | undefined;
  muted: boolean;
  trailing?: ReactNode | undefined;
}

function renderRowContent({
  icon,
  label,
  meta,
  muted,
  trailing,
}: RowContentProps): ReactNode {
  return (
    <>
      {icon !== undefined && <IconSlot name={icon} />}
      <Text
        numberOfLines={rowLabelNumberOfLines}
        variant={rowLabelVariant(muted)}
      >
        {label}
      </Text>
      {meta !== undefined && <Meta>{meta}</Meta>}
      {trailing}
    </>
  );
}

function Row({
  depth = 0,
  icon,
  label,
  meta,
  muted = false,
  onPress,
  trailing,
}: RowProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [hovered, setHovered] = useState(false);

  const rowChildren = renderRowContent({ icon, label, meta, muted, trailing });

  if (onPress !== undefined) {
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onHoverIn={() => {
          setHovered(true);
        }}
        onHoverOut={() => {
          setHovered(false);
        }}
        onPress={onPress}
        style={({ pressed }) =>
          createRowStyle(theme, depth, { hovered, pressed })
        }
      >
        {rowChildren}
      </Pressable>
    );
  }

  return (
    <Box
      style={createRowStyle(theme, depth, { hovered: false, pressed: false })}
    >
      {rowChildren}
    </Box>
  );
}

export { Row };
