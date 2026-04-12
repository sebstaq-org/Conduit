import { expect, it } from "vitest";
import {
  autocompleteHighlightedKey,
  autocompleteVisibleItems,
} from "./autocomplete-state";

const items = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
] as const;

it("limits visible autocomplete items", () => {
  expect(autocompleteVisibleItems(items, 2)).toEqual(items.slice(0, 2));
});

it("keeps an existing highlighted key when it is still visible", () => {
  expect(
    autocompleteHighlightedKey({
      autoHighlight: true,
      getItemKey: (item) => item.id,
      highlightedKey: "two",
      items,
    }),
  ).toBe("two");
});

it("auto highlights the first visible item when the previous key is missing", () => {
  expect(
    autocompleteHighlightedKey({
      autoHighlight: true,
      getItemKey: (item) => item.id,
      highlightedKey: "missing",
      items,
    }),
  ).toBe("one");
});

it("leaves highlight empty when auto highlight is disabled", () => {
  expect(
    autocompleteHighlightedKey({
      autoHighlight: false,
      getItemKey: (item) => item.id,
      highlightedKey: null,
      items,
    }),
  ).toBeNull();
});
