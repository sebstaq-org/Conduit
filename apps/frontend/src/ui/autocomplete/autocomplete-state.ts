interface AutocompleteHighlightedKeyInput<Item> {
  autoHighlight: boolean;
  getItemKey: (item: Item) => string;
  highlightedKey: string | null;
  items: readonly Item[];
}

function autocompleteVisibleItems<Item>(
  items: readonly Item[],
  limit: number,
): readonly Item[] {
  if (limit < 0) {
    return items;
  }

  return items.slice(0, limit);
}

function autocompleteHighlightedKey<Item>({
  autoHighlight,
  getItemKey,
  highlightedKey,
  items,
}: AutocompleteHighlightedKeyInput<Item>): string | null {
  if (
    highlightedKey !== null &&
    items.some((item) => getItemKey(item) === highlightedKey)
  ) {
    return highlightedKey;
  }

  if (!autoHighlight || items.length === 0) {
    return null;
  }

  return getItemKey(items[0]);
}

export { autocompleteHighlightedKey, autocompleteVisibleItems };
