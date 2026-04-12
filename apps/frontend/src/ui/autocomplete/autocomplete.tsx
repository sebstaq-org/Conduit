import { useId } from "react";
import { useTheme } from "@shopify/restyle";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { createAutocompleteRootStyle } from "./autocomplete.styles";
import { AutocompleteInput } from "./autocomplete-input";
import { AutocompleteList } from "./autocomplete-list";
import { useAutocompleteState } from "./autocomplete-state-hook";
import type { AutocompleteProps } from "./autocomplete.types";

function Autocomplete<Item>(
  props: AutocompleteProps<Item>,
): React.JSX.Element {
  const inputNativeId = useId();
  const theme = useTheme<Theme>();
  const state = useAutocompleteState(props);

  return (
    <Box style={createAutocompleteRootStyle(theme)}>
      <AutocompleteInput
        accessibilityLabel={props.accessibilityLabel}
        disabled={props.disabled ?? false}
        onChangeText={state.handleQueryChange}
        onKeyPress={state.handleKeyPress}
        onSubmit={state.handleSubmit}
        placeholder={props.placeholder}
        query={props.query}
        nativeID={inputNativeId}
      />
      <AutocompleteList
        activeHighlightedKey={state.activeHighlightedKey}
        getItemKey={props.getItemKey}
        getItemLabel={props.getItemLabel}
        items={state.visibleItems}
        onItemSelect={props.onItemSelect}
        renderItem={props.renderItem}
        statusText={state.renderedStatusText}
      />
    </Box>
  );
}

export { Autocomplete };
