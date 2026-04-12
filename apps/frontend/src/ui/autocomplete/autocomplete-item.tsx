import { useTheme } from "@shopify/restyle";
import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { Text } from "@/theme";
import type { Theme } from "@/theme";
import { createAutocompleteItemStyle } from "./autocomplete.styles";
import type { AutocompleteRenderItemState } from "./autocomplete.types";

interface AutocompleteItemProps<Item> {
  getItemLabel: (item: Item) => string;
  highlighted: boolean;
  item: Item;
  onItemSelect: (item: Item) => void;
  renderItem?: ((state: AutocompleteRenderItemState<Item>) => ReactNode) | undefined;
}

function AutocompleteItem<Item>({
  getItemLabel,
  highlighted,
  item,
  onItemSelect,
  renderItem,
}: AutocompleteItemProps<Item>): React.JSX.Element {
  const theme = useTheme<Theme>();
  const label = getItemLabel(item);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => {
        onItemSelect(item);
      }}
      style={({ pressed }) =>
        createAutocompleteItemStyle(theme, highlighted, pressed)
      }
    >
      {renderItem?.({ highlighted, item, label }) ?? (
        <Text numberOfLines={1} variant="rowLabel">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export { AutocompleteItem };
