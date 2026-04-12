import { useState } from "react";
import { Box, Text } from "@/theme";
import { usePopoverControls } from "@/ui/popover";
import { Autocomplete } from "./autocomplete";
import type { AutocompleteRenderItemState } from "./autocomplete.types";

const mockAutocompleteLimit = 12;

const mockProjectPathSuggestionList: readonly MockProjectPathSuggestion[] = [
  {
    cwd: "/srv/devops/repos/w4/Conduit",
    suggestionId: "mock:srv-devops-repos-w4-conduit",
  },
  {
    cwd: "/home/base/DevOps",
    suggestionId: "mock:home-base-devops",
  },
  {
    cwd: "/home/base/.codex/sessions",
    suggestionId: "mock:home-base-codex-sessions",
  },
  {
    cwd: "/tmp/conduit-ui-workspace",
    suggestionId: "mock:tmp-conduit-ui-workspace",
  },
  {
    cwd: "/srv/devops/repos/w4/Conduit/apps/frontend",
    suggestionId: "mock:conduit-apps-frontend",
  },
  {
    cwd: "/srv/devops/repos/w4/Conduit/packages/app-client",
    suggestionId: "mock:conduit-packages-app-client",
  },
  {
    cwd: "/srv/devops/repos/w4/Conduit/packages/app-core",
    suggestionId: "mock:conduit-packages-app-core",
  },
  {
    cwd: "/srv/devops/repos/w4/Conduit/packages/session-client",
    suggestionId: "mock:conduit-packages-session-client",
  },
  {
    cwd: "/srv/devops/repos/w4/Conduit/backend/service",
    suggestionId: "mock:conduit-backend-service",
  },
  {
    cwd: "/home/base/experiments/conduit-autocomplete",
    suggestionId: "mock:home-base-experiments-autocomplete",
  },
  {
    cwd: "/home/base/experiments/mobile-popover",
    suggestionId: "mock:home-base-experiments-popover",
  },
  {
    cwd: "/var/tmp/conduit-session-fixtures",
    suggestionId: "mock:var-tmp-conduit-session-fixtures",
  },
];

interface MockProjectPathSuggestion {
  cwd: string;
  suggestionId: string;
}

interface MockProjectPathSuggestionItem {
  cwd: string;
  suggestionId: string;
  type: "suggestion";
}

interface MockProjectPathManualItem {
  cwd: string;
  itemId: string;
  type: "manual";
}

type MockProjectPathItem =
  | MockProjectPathManualItem
  | MockProjectPathSuggestionItem;

function mockProjectPathSuggestions(
  query: string,
): readonly MockProjectPathSuggestion[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return mockProjectPathSuggestionList;
  }

  return mockProjectPathSuggestionList.filter((suggestion) =>
    suggestion.cwd.toLocaleLowerCase().includes(normalizedQuery),
  );
}

function mockProjectPathItems(query: string): MockProjectPathItem[] {
  const suggestions = mockProjectPathSuggestions(query);
  const items: MockProjectPathItem[] = suggestions.map((suggestion) => ({
    cwd: suggestion.cwd,
    suggestionId: suggestion.suggestionId,
    type: "suggestion",
  }));
  const cwd = query.trim();

  if (
    cwd.length > 0 &&
    !suggestions.some((suggestion) => suggestion.cwd === cwd)
  ) {
    items.push({
      cwd,
      itemId: `manual:${cwd}`,
      type: "manual",
    });
  }

  return items;
}

function mockProjectPathItemKey(item: MockProjectPathItem): string {
  if (item.type === "manual") {
    return item.itemId;
  }

  return item.suggestionId;
}

function mockProjectPathItemLabel(item: MockProjectPathItem): string {
  if (item.type === "manual") {
    return `Add ${item.cwd}`;
  }

  return item.cwd;
}

function renderMockProjectPathItem({
  item,
}: AutocompleteRenderItemState<MockProjectPathItem>): React.ReactNode {
  if (item.type === "manual") {
    return (
      <Box>
        <Text numberOfLines={1} variant="rowLabel">
          Add path
        </Text>
        <Text numberOfLines={1} variant="meta">
          {item.cwd}
        </Text>
      </Box>
    );
  }

  return (
    <Text numberOfLines={1} variant="rowLabel">
      {item.cwd}
    </Text>
  );
}

interface AutocompletePopoverMockContentState {
  handleItemSelect: (item: MockProjectPathItem) => void;
  handleQueryChange: (query: string) => void;
  handleSubmitQuery: (query: string) => void;
  items: MockProjectPathItem[];
  query: string;
  statusText: string | undefined;
}

function useAutocompletePopoverMockContentState(): AutocompletePopoverMockContentState {
  const { close } = usePopoverControls();
  const [query, setQuery] = useState("");
  const [selectedCwd, setSelectedCwd] = useState<string | null>(null);
  const items = mockProjectPathItems(query);
  let statusText: string | undefined = undefined;

  if (selectedCwd !== null) {
    statusText = `Selected mock path ${selectedCwd}`;
  }

  function selectCwd(cwd: string): void {
    const trimmedCwd = cwd.trim();

    if (trimmedCwd.length === 0) {
      return;
    }

    setSelectedCwd(trimmedCwd);
    setQuery("");
    close();
  }

  function handleItemSelect(item: MockProjectPathItem): void {
    selectCwd(item.cwd);
  }

  return {
    handleItemSelect,
    handleQueryChange: setQuery,
    handleSubmitQuery: selectCwd,
    items,
    query,
    statusText,
  };
}

function AutocompletePopoverMockContent(): React.JSX.Element {
  const state = useAutocompletePopoverMockContentState();

  return (
    <Autocomplete
      accessibilityLabel="Project path"
      emptyText="No mock paths found"
      getItemKey={mockProjectPathItemKey}
      getItemLabel={mockProjectPathItemLabel}
      items={state.items}
      limit={mockAutocompleteLimit}
      onItemSelect={state.handleItemSelect}
      onQueryChange={state.handleQueryChange}
      onSubmitQuery={state.handleSubmitQuery}
      placeholder="Search or paste a mock path"
      query={state.query}
      renderItem={renderMockProjectPathItem}
      statusText={state.statusText}
    />
  );
}

export { AutocompletePopoverMockContent };
