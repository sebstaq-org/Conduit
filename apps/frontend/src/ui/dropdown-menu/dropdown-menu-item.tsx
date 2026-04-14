import { Item } from "@rn-primitives/dropdown-menu";
import { useTheme } from "@shopify/restyle";
import { Text } from "@/theme";
import type { Theme } from "@/theme";
import {
  createDropdownMenuItemStyle,
  dropdownMenuItemLabelVariant,
} from "./dropdown-menu.styles";

interface DropdownMenuItemProps {
  disabled?: boolean | undefined;
  label: string;
  onSelect: () => void;
}

function DropdownMenuItem({
  disabled = false,
  label,
  onSelect,
}: DropdownMenuItemProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Item
      accessibilityLabel={label}
      closeOnPress
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) =>
        createDropdownMenuItemStyle(theme, { disabled, pressed })
      }
    >
      <Text numberOfLines={1} variant={dropdownMenuItemLabelVariant(disabled)}>
        {label}
      </Text>
    </Item>
  );
}

export { DropdownMenuItem };
