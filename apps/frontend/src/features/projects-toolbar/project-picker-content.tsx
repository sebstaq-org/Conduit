import { useState } from "react";
import {
  addProjectPath,
  useAddProjectMutation,
  useGetProjectSuggestionsQuery,
} from "@/app-state";
import { Box, Text } from "@/theme";
import { Autocomplete } from "@/ui";
import type { AutocompleteRenderItemState } from "@/ui";
import { usePopoverControls } from "@/ui/popover";

const projectPickerSuggestionLimit = 12;

interface ProjectPickerSuggestion {
  cwd: string;
  suggestionId: string;
}

interface ProjectPickerSuggestionItem {
  cwd: string;
  suggestionId: string;
  type: "suggestion";
}

interface ProjectPickerManualItem {
  cwd: string;
  itemId: string;
  type: "manual";
}

type ProjectPickerItem = ProjectPickerManualItem | ProjectPickerSuggestionItem;
interface ProjectPickerState {
  handleCwdAdd: (cwd: string) => void;
  handleItemSelect: (item: ProjectPickerItem) => void;
  handleQueryChange: (query: string) => void;
  disabled: boolean;
  items: ProjectPickerItem[];
  loading: boolean;
  query: string;
  statusText: string | undefined;
}

function projectPickerItems(
  suggestions: readonly ProjectPickerSuggestionItem[],
  query: string,
): ProjectPickerItem[] {
  const items: ProjectPickerItem[] = [...suggestions];
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

function projectPickerItemKey(item: ProjectPickerItem): string {
  if (item.type === "manual") {
    return item.itemId;
  }

  return item.suggestionId;
}

function projectPickerItemLabel(item: ProjectPickerItem): string {
  if (item.type === "manual") {
    return `Add ${item.cwd}`;
  }

  return item.cwd;
}

function projectPickerErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  return "Project request failed";
}

function projectPickerSuggestionItem(
  suggestion: ProjectPickerSuggestion,
): ProjectPickerSuggestionItem {
  return {
    cwd: suggestion.cwd,
    suggestionId: suggestion.suggestionId,
    type: "suggestion",
  };
}

function projectPickerStatusText({
  addProjectError,
  addProjectRequestError,
  addingProject,
  suggestionsError,
  suggestionsRequestError,
}: {
  addProjectError: boolean;
  addProjectRequestError: unknown;
  addingProject: boolean;
  suggestionsError: boolean;
  suggestionsRequestError: unknown;
}): string | undefined {
  if (addProjectError) {
    return projectPickerErrorMessage(addProjectRequestError);
  }

  if (suggestionsError) {
    return projectPickerErrorMessage(suggestionsRequestError);
  }

  if (addingProject) {
    return "Adding project";
  }

  return undefined;
}

function renderProjectPickerItem({
  item,
}: AutocompleteRenderItemState<ProjectPickerItem>): React.ReactNode {
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

function useProjectPickerState(): ProjectPickerState {
  const { close } = usePopoverControls();
  const [query, setQuery] = useState("");
  const suggestionsQuery = useGetProjectSuggestionsQuery({
    limit: projectPickerSuggestionLimit,
    query,
  });
  const [addProject, addProjectState] = useAddProjectMutation();
  const suggestions =
    suggestionsQuery.data?.suggestions.map(projectPickerSuggestionItem) ?? [];
  const items = projectPickerItems(suggestions, query);
  const loading =
    suggestionsQuery.isFetching ||
    suggestionsQuery.isLoading ||
    addProjectState.isLoading;

  function handleCwdAdd(cwd: string): void {
    void addProjectPath({
      addProject,
      close,
      cwd,
      disabled: addProjectState.isLoading,
      setQuery,
    });
  }

  function handleItemSelect(item: ProjectPickerItem): void {
    handleCwdAdd(item.cwd);
  }

  return {
    disabled: addProjectState.isLoading,
    handleCwdAdd,
    handleItemSelect,
    handleQueryChange: setQuery,
    items,
    loading,
    query,
    statusText: projectPickerStatusText({
      addProjectError: addProjectState.isError,
      addProjectRequestError: addProjectState.error,
      addingProject: addProjectState.isLoading,
      suggestionsError: suggestionsQuery.isError,
      suggestionsRequestError: suggestionsQuery.error,
    }),
  };
}

function ProjectPickerContent(): React.JSX.Element {
  const state = useProjectPickerState();

  return (
    <Autocomplete
      accessibilityLabel="Project path"
      disabled={state.disabled}
      emptyText="No project paths found"
      getItemKey={projectPickerItemKey}
      getItemLabel={projectPickerItemLabel}
      items={state.items}
      limit={projectPickerSuggestionLimit}
      loading={state.loading}
      onItemSelect={state.handleItemSelect}
      onQueryChange={state.handleQueryChange}
      onSubmitQuery={state.handleCwdAdd}
      placeholder="Search or paste a project path"
      query={state.query}
      renderItem={renderProjectPickerItem}
      statusText={state.statusText}
    />
  );
}

export { ProjectPickerContent };
