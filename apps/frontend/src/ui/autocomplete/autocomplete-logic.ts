import type {
  TextInputKeyPressEvent,
} from "react-native";

interface AutocompleteHighlightedItemInput<Item> {
  getItemKey: (item: Item) => string;
  highlightedKey: string | null;
  items: readonly Item[];
}

interface AutocompleteNextKeyInput<Item>
  extends AutocompleteHighlightedItemInput<Item> {
  direction: 1 | -1;
}

interface AutocompleteCommandInput<Item>
  extends AutocompleteHighlightedItemInput<Item> {
  onItemSelect: (item: Item) => void;
  onSubmitQuery?: ((query: string) => void) | undefined;
  query: string;
  setHighlightedKey: (key: string | null) => void;
}

interface AutocompleteStatusInput {
  emptyText: string | undefined;
  loading: boolean;
  statusText: string | undefined;
  visibleItemCount: number;
}

const autocompleteNoHighlightIndex = -1;

function highlightedItemIndex<Item>({
  getItemKey,
  highlightedKey,
  items,
}: AutocompleteHighlightedItemInput<Item>): number {
  if (highlightedKey === null) {
    return autocompleteNoHighlightIndex;
  }

  return items.findIndex((item) => getItemKey(item) === highlightedKey);
}

function autocompleteHighlightedItem<Item>({
  getItemKey,
  highlightedKey,
  items,
}: AutocompleteHighlightedItemInput<Item>): Item | undefined {
  return items.find((item) => getItemKey(item) === highlightedKey);
}

function autocompleteNextHighlightedKey<Item>({
  direction,
  getItemKey,
  highlightedKey,
  items,
}: AutocompleteNextKeyInput<Item>): string | null {
  if (items.length === 0) {
    return null;
  }

  const currentIndex = highlightedItemIndex({
    getItemKey,
    highlightedKey,
    items,
  });
  let nextIndex = 0;

  if (currentIndex !== autocompleteNoHighlightIndex) {
    nextIndex = (currentIndex + direction + items.length) % items.length;
  }

  return getItemKey(items[nextIndex]);
}

function autocompleteNextInput<Item>(
  direction: 1 | -1,
  input: AutocompleteCommandInput<Item>,
): AutocompleteNextKeyInput<Item> {
  return {
    direction,
    getItemKey: input.getItemKey,
    highlightedKey: input.highlightedKey,
    items: input.items,
  };
}

function autocompleteStatusText({
  emptyText,
  loading,
  statusText,
  visibleItemCount,
}: AutocompleteStatusInput): string | undefined {
  if (statusText !== undefined) {
    return statusText;
  }

  if (loading) {
    return "Loading";
  }

  if (visibleItemCount === 0) {
    return emptyText;
  }

  return undefined;
}

function submitAutocompleteQuery<Item>(
  input: AutocompleteCommandInput<Item>,
): void {
  const highlightedItem = autocompleteHighlightedItem(input);

  if (highlightedItem !== undefined) {
    input.onItemSelect(highlightedItem);
    return;
  }

  input.onSubmitQuery?.(input.query);
}

function handleAutocompleteKeyPress<Item>(
  event: TextInputKeyPressEvent,
  input: AutocompleteCommandInput<Item>,
): void {
  if (event.nativeEvent.key === "ArrowDown") {
    input.setHighlightedKey(
      autocompleteNextHighlightedKey(autocompleteNextInput(1, input)),
    );
    return;
  }

  if (event.nativeEvent.key === "ArrowUp") {
    input.setHighlightedKey(
      autocompleteNextHighlightedKey(autocompleteNextInput(-1, input)),
    );
    return;
  }

  if (event.nativeEvent.key === "Enter") {
    submitAutocompleteQuery(input);
  }
}

export {
  autocompleteStatusText,
  handleAutocompleteKeyPress,
  submitAutocompleteQuery,
};
export type { AutocompleteCommandInput };
