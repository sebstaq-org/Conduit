import { useTheme } from "@shopify/restyle";
import { Pressable } from "react-native";
import { Text } from "@/theme";
import type { Theme } from "@/theme";
import { createMenuItemStyle, menuItemLabelVariant } from "./menu.styles";

interface MenuItemProps {
  disabled?: boolean | undefined;
  label: string;
  onSelect: () => void;
}

function MenuItem({
  disabled = false,
  label,
  onSelect,
}: MenuItemProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => createMenuItemStyle(theme, { disabled, pressed })}
    >
      <Text numberOfLines={1} variant={menuItemLabelVariant(disabled)}>
        {label}
      </Text>
    </Pressable>
  );
}

export { MenuItem };
