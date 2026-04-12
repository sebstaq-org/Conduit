import { useTheme } from "@shopify/restyle";
import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { Text } from "@/theme";
import type { Theme } from "@/theme";
import {
  autocompleteStatusTextVariant,
  createAutocompleteDropdownContentStyle,
  createAutocompleteDropdownFrameStyle,
} from "./autocomplete.styles";
import { AutocompleteItem } from "./autocomplete-item";
import type { AutocompleteRenderItemState } from "./autocomplete.types";

interface AutocompleteListProps<Item> {
  activeHighlightedKey: string | null;
  getItemKey: (item: Item) => string;
  getItemLabel: (item: Item) => string;
  items: readonly Item[];
  onItemSelect: (item: Item) => void;
  renderItem?: ((state: AutocompleteRenderItemState<Item>) => ReactNode) | undefined;
  statusText?: string | undefined;
}

function AutocompleteList<Item>({
  activeHighlightedKey,
  getItemKey,
  getItemLabel,
  items,
  onItemSelect,
  renderItem,
  statusText,
}: AutocompleteListProps<Item>): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <ScrollView
      contentContainerStyle={createAutocompleteDropdownContentStyle(theme)}
      keyboardShouldPersistTaps="handled"
      style={createAutocompleteDropdownFrameStyle(theme)}
    >
      {statusText !== undefined && (
        <Text variant={autocompleteStatusTextVariant}>{statusText}</Text>
      )}
      {items.map((item) => {
        const itemKey = getItemKey(item);
        return (
          <AutocompleteItem
            key={itemKey}
            getItemLabel={getItemLabel}
            highlighted={itemKey === activeHighlightedKey}
            item={item}
            onItemSelect={onItemSelect}
            renderItem={renderItem}
          />
        );
      })}
    </ScrollView>
  );
}

export { AutocompleteList };
