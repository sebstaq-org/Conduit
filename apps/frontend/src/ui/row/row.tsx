import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Text, View } from "react-native";
import { IconSlot } from "@/ui/icon-slot";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";
import { Meta } from "@/ui/meta";
import { panelTokens } from "@/ui/tokens";
import { rowStyles } from "./row.styles";

interface RowProps {
  depth?: number;
  icon?: IconSlotName | undefined;
  label: string;
  meta?: string | undefined;
  muted?: boolean | undefined;
  trailing?: ReactNode | undefined;
}

function labelStyle(muted: boolean): StyleProp<TextStyle> {
  if (muted) {
    return [rowStyles.label, rowStyles.mutedLabel];
  }

  return [rowStyles.label];
}

function Row({
  depth = 0,
  icon,
  label,
  meta,
  muted = false,
  trailing,
}: RowProps): React.JSX.Element {
  return (
    <View
      style={[
        rowStyles.row,
        { paddingLeft: depth * panelTokens.space.indent },
      ]}
    >
      {icon !== undefined && <IconSlot name={icon} />}
      <Text numberOfLines={1} style={labelStyle(muted)}>
        {label}
      </Text>
      {meta !== undefined && <Meta>{meta}</Meta>}
      {trailing}
    </View>
  );
}

export { Row };
