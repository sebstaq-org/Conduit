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
  leading?: ReactNode | undefined;
  meta?: string | undefined;
  reserveLeadingSpace?: boolean | undefined;
  muted?: boolean | undefined;
  onPress?: (() => void) | undefined;
  selected?: boolean | undefined;
  trailing?: ReactNode | undefined;
}

interface RowContentProps {
  icon?: IconSlotName | undefined;
  label: string;
  leading?: ReactNode | undefined;
  meta?: string | undefined;
  muted: boolean;
  reserveLeadingSpace: boolean;
  theme: Theme;
  trailing?: ReactNode | undefined;
}

function renderLeadingSlot(args: {
  leading: ReactNode | undefined;
  reserveLeadingSpace: boolean;
  theme: Theme;
}): ReactNode {
  if (args.leading === undefined && !args.reserveLeadingSpace) {
    return null;
  }

  return (
    <Box
      alignItems="center"
      height={args.theme.panel.icon}
      justifyContent="center"
      width={args.theme.panel.icon}
    >
      {args.leading}
    </Box>
  );
}

function renderRowContent({
  icon,
  label,
  leading,
  meta,
  muted,
  reserveLeadingSpace,
  theme,
  trailing,
}: RowContentProps): ReactNode {
  return (
    <>
      {renderLeadingSlot({ leading, reserveLeadingSpace, theme })}
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

interface PressableRowProps {
  children: ReactNode;
  depth: number;
  hovered: boolean;
  label: string;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
  selected: boolean;
  theme: Theme;
}

function renderPressableRow({
  children,
  depth,
  hovered,
  label,
  onHoverIn,
  onHoverOut,
  onPress,
  selected,
  theme,
}: PressableRowProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onPress={onPress}
      style={({ pressed }) =>
        createRowStyle(theme, depth, { hovered, pressed, selected })
      }
    >
      {children}
    </Pressable>
  );
}

interface StaticRowProps {
  children: ReactNode;
  depth: number;
  selected: boolean;
  theme: Theme;
}

function renderStaticRow({
  children,
  depth,
  selected,
  theme,
}: StaticRowProps): React.JSX.Element {
  return (
    <Box
      style={createRowStyle(theme, depth, {
        hovered: false,
        pressed: false,
        selected,
      })}
    >
      {children}
    </Box>
  );
}

function Row({
  depth = 0,
  icon,
  label,
  leading,
  meta,
  muted = false,
  onPress,
  reserveLeadingSpace = false,
  selected = false,
  trailing,
}: RowProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [hovered, setHovered] = useState(false);

  const rowChildren = renderRowContent({
    icon,
    label,
    leading,
    meta,
    muted,
    reserveLeadingSpace,
    theme,
    trailing,
  });

  if (onPress !== undefined) {
    return renderPressableRow({
      children: rowChildren,
      depth,
      hovered,
      label,
      onHoverIn: () => {
        setHovered(true);
      },
      onHoverOut: () => {
        setHovered(false);
      },
      onPress,
      selected,
      theme,
    });
  }

  return renderStaticRow({ children: rowChildren, depth, selected, theme });
}

export { Row };
