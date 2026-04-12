import { useState } from "react";
import type { TextInputKeyPressEvent } from "react-native";
import { autocompleteDefaultLimit } from "./autocomplete.styles";
import {
  autocompleteStatusText,
  handleAutocompleteKeyPress,
  submitAutocompleteQuery,
} from "./autocomplete-logic";
import type { AutocompleteCommandInput } from "./autocomplete-logic";
import {
  autocompleteHighlightedKey,
  autocompleteVisibleItems,
} from "./autocomplete-state";
import type { AutocompleteProps } from "./autocomplete.types";

interface AutocompleteState<Item> {
  activeHighlightedKey: string | null;
  handleKeyPress: (event: TextInputKeyPressEvent) => void;
  handleQueryChange: (query: string) => void;
  handleSubmit: () => void;
  renderedStatusText: string | undefined;
  visibleItems: readonly Item[];
}

interface AutocompleteDerivedState<Item> {
  activeHighlightedKey: string | null;
  renderedStatusText: string | undefined;
  visibleItems: readonly Item[];
}

interface AutocompleteCommandInputArgs<Item> {
  highlightedKey: string | null;
  input: AutocompleteProps<Item>;
  items: readonly Item[];
  setHighlightedKey: (key: string | null) => void;
}

function autocompleteCommandInput<Item>({
  highlightedKey,
  input,
  items,
  setHighlightedKey,
}: AutocompleteCommandInputArgs<Item>): AutocompleteCommandInput<Item> {
  return {
    getItemKey: input.getItemKey,
    highlightedKey,
    items,
    onItemSelect: input.onItemSelect,
    onSubmitQuery: input.onSubmitQuery,
    query: input.query,
    setHighlightedKey,
  };
}

function autocompleteDerivedState<Item>(
  input: AutocompleteProps<Item>,
  highlightedKey: string | null,
): AutocompleteDerivedState<Item> {
  const visibleItems = autocompleteVisibleItems(
    input.items,
    input.limit ?? autocompleteDefaultLimit,
  );
  const loading = input.loading ?? false;

  return {
    activeHighlightedKey: autocompleteHighlightedKey({
      autoHighlight: input.autoHighlight ?? true,
      getItemKey: input.getItemKey,
      highlightedKey,
      items: visibleItems,
    }),
    renderedStatusText: autocompleteStatusText({
      emptyText: input.emptyText,
      loading,
      statusText: input.statusText,
      visibleItemCount: visibleItems.length,
    }),
    visibleItems,
  };
}

function useAutocompleteState<Item>(
  input: AutocompleteProps<Item>,
): AutocompleteState<Item> {
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const derivedState = autocompleteDerivedState(input, highlightedKey);

  function handleQueryChange(query: string): void {
    setHighlightedKey(null);
    input.onQueryChange(query);
  }

  function handleKeyPress(event: TextInputKeyPressEvent): void {
    const commandInput = autocompleteCommandInput({
      highlightedKey: derivedState.activeHighlightedKey,
      input,
      items: derivedState.visibleItems,
      setHighlightedKey,
    });

    handleAutocompleteKeyPress(event, commandInput);
  }

  function handleSubmit(): void {
    submitAutocompleteQuery(
      autocompleteCommandInput({
        highlightedKey: derivedState.activeHighlightedKey,
        input,
        items: derivedState.visibleItems,
        setHighlightedKey,
      }),
    );
  }

  return {
    activeHighlightedKey: derivedState.activeHighlightedKey,
    handleKeyPress,
    handleQueryChange,
    handleSubmit,
    renderedStatusText: derivedState.renderedStatusText,
    visibleItems: derivedState.visibleItems,
  };
}

export { useAutocompleteState };
