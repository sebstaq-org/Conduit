import { useTheme } from "@shopify/restyle";
import { useGetSessionGroupsQuery, useOpenSessionMutation } from "@/app-state";
import type { Theme } from "@/theme";
import { VirtualList } from "@/ui";
import { NavigationPanelScrollRowItem } from "./navigation-panel-scroll-row-item";
import {
  createNavigationPanelRows,
  createSessionRows,
  navigationPanelRowType,
} from "./navigation-panel-scroll-rows";

interface NavigationPanelScrollContentProps {
  onSessionSelected?: (() => void) | undefined;
}

const defaultUpdatedWithinDays = 5;

function createNavigationPanelContentContainerStyle(theme: Theme): {
  paddingBottom: number;
} {
  return { paddingBottom: theme.spacing.scrollBottom };
}

function NavigationPanelScrollContent({
  onSessionSelected,
}: NavigationPanelScrollContentProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const { data, error, isError, isLoading } = useGetSessionGroupsQuery({
    updatedWithinDays: defaultUpdatedWithinDays,
  });
  const [openSession, openSessionState] = useOpenSessionMutation();
  const showOpenSessionError =
    openSessionState.isError && !openSessionState.isSuccess;
  const sessionRows = createSessionRows({
    data,
    error,
    isError,
    isLoading,
    showOpenSessionError,
  });

  return (
    <VirtualList
      contentContainerStyle={createNavigationPanelContentContainerStyle(theme)}
      data={createNavigationPanelRows(sessionRows)}
      getItemType={navigationPanelRowType}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => (
        <NavigationPanelScrollRowItem
          onSessionSelected={onSessionSelected}
          openSession={openSession}
          row={item}
        />
      )}
      showsVerticalScrollIndicator
    />
  );
}

export { NavigationPanelScrollContent };
