import { useTheme } from "@shopify/restyle";
import {
  openSessionHistoryLimit,
  openSessionRow,
  selectActiveSession,
  useGetSessionGroupsQuery,
  useOpenSessionMutation,
} from "@/app-state";
import type { AppDispatch, OpenSessionMutationArg } from "@/app-state";
import { useDispatch, useSelector } from "react-redux";
import type { Theme } from "@/theme";
import type {
  OpenSessionTarget,
  SessionListTarget,
} from "@/features/session-list/session-list-target";
import { showOpenSessionFailureToast } from "@/features/session-notifications";
import { VirtualList } from "@/ui";
import { selectNavigationPanelSessionTarget } from "./navigation-panel-session-target";
import { NavigationPanelScrollRowItem } from "./navigation-panel-scroll-row-item";
import {
  createNavigationPanelRows,
  createSessionRows,
  navigationPanelRowType,
} from "./navigation-panel-scroll-rows";

interface NavigationPanelScrollContentProps {
  onSessionTargetSelected?: ((target: SessionListTarget) => void) | undefined;
}

const defaultSessionGroupsQuery = {};

function openSessionRequest(target: OpenSessionTarget): OpenSessionMutationArg {
  return {
    cwd: target.cwd,
    limit: openSessionHistoryLimit,
    provider: target.provider,
    sessionId: target.sessionId,
    title: target.title,
  };
}

function createNavigationPanelContentContainerStyle(theme: Theme): {
  paddingBottom: number;
} {
  return { paddingBottom: theme.spacing.scrollBottom };
}

interface NavigationPanelListProps {
  activeSession: ReturnType<typeof selectActiveSession>;
  onSessionTargetSelected: (target: SessionListTarget) => void;
  sessionRows: ReturnType<typeof createSessionRows>;
  theme: Theme;
}

function renderNavigationPanelList({
  activeSession,
  onSessionTargetSelected,
  sessionRows,
  theme,
}: NavigationPanelListProps): React.JSX.Element {
  return (
    <VirtualList
      contentContainerStyle={createNavigationPanelContentContainerStyle(theme)}
      data={createNavigationPanelRows(sessionRows)}
      getItemType={navigationPanelRowType}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => (
        <NavigationPanelScrollRowItem
          activeSession={activeSession}
          onSessionTargetSelected={onSessionTargetSelected}
          row={item}
        />
      )}
      showsVerticalScrollIndicator
    />
  );
}

function NavigationPanelScrollContent({
  onSessionTargetSelected,
}: NavigationPanelScrollContentProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const dispatch = useDispatch<AppDispatch>();
  const { data, error, isError, isLoading } = useGetSessionGroupsQuery(
    defaultSessionGroupsQuery,
  );
  const [openSession, openSessionState] = useOpenSessionMutation();
  const activeSession = useSelector(selectActiveSession);
  const showOpenSessionError =
    openSessionState.isError && !openSessionState.isSuccess;
  const sessionRows = createSessionRows({
    activeSession,
    data,
    error,
    isError,
    isLoading,
    openSessionError: openSessionState.error,
    showOpenSessionError,
  });

  function handleOpenSessionTarget(target: OpenSessionTarget): void {
    void openSessionRow({
      onFailure: showOpenSessionFailureToast,
      openSession,
      request: openSessionRequest(target),
    });
  }

  function handleSessionTargetSelected(target: SessionListTarget): void {
    selectNavigationPanelSessionTarget({
      dispatch,
      onOpenSessionTarget: handleOpenSessionTarget,
      onSessionTargetSelected,
      target,
    });
  }

  return renderNavigationPanelList({
    activeSession,
    onSessionTargetSelected: handleSessionTargetSelected,
    sessionRows,
    theme,
  });
}

export { NavigationPanelScrollContent };
