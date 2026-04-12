import type { ReactNode } from "react";

interface AutocompleteRenderItemState<Item> {
  highlighted: boolean;
  item: Item;
  label: string;
}

interface AutocompleteProps<Item> {
  accessibilityLabel: string;
  autoHighlight?: boolean | undefined;
  disabled?: boolean | undefined;
  emptyText?: string | undefined;
  getItemKey: (item: Item) => string;
  getItemLabel: (item: Item) => string;
  items: readonly Item[];
  limit?: number | undefined;
  loading?: boolean | undefined;
  onItemSelect: (item: Item) => void;
  onQueryChange: (query: string) => void;
  onSubmitQuery?: ((query: string) => void) | undefined;
  placeholder: string;
  query: string;
  renderItem?: ((state: AutocompleteRenderItemState<Item>) => ReactNode) | undefined;
  statusText?: string | undefined;
}

export type { AutocompleteProps, AutocompleteRenderItemState };
