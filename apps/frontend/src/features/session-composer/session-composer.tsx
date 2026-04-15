import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { useDispatch, useSelector } from "react-redux";
import {
  activeSessionOpened,
  canSubmitPrompt,
  conduitApi,
  draftSessionConfigOptionSelected,
  draftSessionProviderSelected,
  selectActiveSession,
  submitPrompt,
  useGetProvidersConfigSnapshotQuery,
  useNewSessionMutation,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useSetSessionConfigOptionMutation,
} from "@/app-state";
import type { ActiveSession } from "@/app-state";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import type { ProviderId, SessionConfigOption } from "@conduit/session-client";
import { SessionComposerActionRow } from "./session-composer-action-row";
import { SessionComposerInput } from "./session-composer-input";
import {
  createSessionComposerSurfaceStyle,
  sessionComposerBackgroundColor,
  sessionComposerBorderColor,
  sessionComposerBorderRadius,
  sessionComposerGap,
  sessionComposerPaddingX,
  sessionComposerPaddingY,
} from "./session-composer.styles";

interface SessionComposerSurfaceArgs {
  activeSession: ActiveSession | null;
  canSend: boolean;
  configOptions: SessionConfigOption[] | null;
  draft: string;
  errorMessage: string | null;
  handleConfigOptionSelect: (configId: string, value: string) => void;
  handleProviderSelect: (provider: ProviderId) => void;
  handleSend: () => void;
  isConfigUpdating: boolean;
  setDraft: (draft: string) => void;
  theme: Theme;
}

type DraftActiveSession = Extract<ActiveSession, { kind: "draft" }>;

function renderComposerErrorMessage(message: string | null): React.JSX.Element | null {
  if (message === null) {
    return null;
  }
  return <Text variant="rowLabelMuted">{message}</Text>;
}

function selectDraftProvider(
  dispatch: ReturnType<typeof useDispatch>,
  provider: ProviderId,
): void {
  dispatch(draftSessionProviderSelected(provider));
}

function applyDraftSelectedConfigValues(
  configOptions: SessionConfigOption[] | null,
  selectedValues: Record<string, string> | undefined,
): SessionConfigOption[] | null {
  if (configOptions === null || selectedValues === undefined) {
    return configOptions;
  }
  return configOptions.map((option) => {
    const selected = selectedValues[option.id];
    if (selected === undefined) {
      return option;
    }
    return {
      ...option,
      currentValue: selected,
    };
  });
}

function draftProviderConfigOptions(
  activeSession: DraftActiveSession,
  selectedEntry: {
    status: string;
    configOptions: SessionConfigOption[] | null;
  } | null,
): SessionConfigOption[] | null {
  if (
    activeSession.provider === null ||
    selectedEntry === null ||
    selectedEntry.status !== "ready"
  ) {
    return null;
  }
  return applyDraftSelectedConfigValues(
    selectedEntry.configOptions,
    activeSession.selectedConfigByProvider[activeSession.provider],
  );
}

function renderSessionComposerSurface({
  activeSession,
  canSend,
  configOptions,
  draft,
  errorMessage,
  handleConfigOptionSelect,
  handleProviderSelect,
  handleSend,
  isConfigUpdating,
  setDraft,
  theme,
}: SessionComposerSurfaceArgs): React.JSX.Element {
  return (
    <Box
      backgroundColor={sessionComposerBackgroundColor}
      borderColor={sessionComposerBorderColor}
      borderRadius={sessionComposerBorderRadius}
      borderWidth={1}
      gap={sessionComposerGap}
      px={sessionComposerPaddingX}
      py={sessionComposerPaddingY}
      style={createSessionComposerSurfaceStyle(theme)}
    >
      <SessionComposerInput draft={draft} setDraft={setDraft} />
      <SessionComposerActionRow
        canSend={canSend}
        configOptions={configOptions}
        isUpdatingConfig={isConfigUpdating}
        onSend={handleSend}
        isDraft={activeSession?.kind === "draft"}
        onConfigOptionSelect={handleConfigOptionSelect}
        onProviderSelect={handleProviderSelect}
        provider={activeSession?.provider ?? null}
      />
      {renderComposerErrorMessage(errorMessage)}
    </Box>
  );
}

function SessionComposer(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const dispatch = useDispatch();
  const activeSession = useSelector(selectActiveSession);
  const [newSession, newSessionState] = useNewSessionMutation();
  const [openSession] = useOpenSessionMutation();
  const [promptSession, promptSessionState] = usePromptSessionMutation();
  const [setSessionConfigOption, setSessionConfigOptionState] =
    useSetSessionConfigOptionMutation();
  const {
    data: providersConfigSnapshot,
    isError: providersConfigSnapshotError,
  } = useGetProvidersConfigSnapshotQuery(null);
  const [draft, setDraft] = useState("");
  const trimmedDraft = draft.trim();

  const draftSnapshotEntry =
    activeSession?.kind === "draft" && activeSession.provider !== null
      ? (providersConfigSnapshot?.entries.find(
          (entry) => entry.provider === activeSession.provider,
        ) ?? null)
      : null;
  const draftProviderReady =
    activeSession?.kind !== "draft"
      ? true
      : activeSession.provider !== null && draftSnapshotEntry?.status === "ready";
  const openSessionConfigSyncBlocked =
    activeSession?.kind === "open" ? activeSession.configSyncBlocked : false;

  const canSend = canSubmitPrompt(
    activeSession,
    promptSessionState.isLoading || newSessionState.isLoading,
    trimmedDraft,
    draftProviderReady,
    openSessionConfigSyncBlocked,
  );

  function handleSend(): void {
    if (canSend && activeSession !== null) {
      void submitPrompt({
        activeSession,
        newSession,
        openSession,
        onDraftPromptCommitted: (session) => {
          dispatch(
            activeSessionOpened({
              configOptions: session.configOptions,
              configSyncBlocked: session.configSyncBlocked,
              configSyncError: session.configSyncError,
              cwd: activeSession.cwd,
              kind: "open",
              modes: session.modes,
              models: session.models,
              openSessionId: session.openSessionId,
              provider: session.provider,
              sessionId: session.sessionId,
              title: null,
            }),
          );
          void dispatch(
            conduitApi.util.invalidateTags([
              { id: "LIST", type: "SessionGroups" },
            ]),
          );
        },
        promptSession,
        setSessionConfigOption,
        setDraft,
        text: trimmedDraft,
      });
    }
  }

  function handleConfigOptionSelect(
    configId: string,
    value: string,
  ): void {
    if (activeSession?.kind === "open") {
      void setSessionConfigOption({
        configId,
        provider: activeSession.provider,
        sessionId: activeSession.sessionId,
        value,
      });
      return;
    }
    if (activeSession?.kind !== "draft" || activeSession.provider === null) {
      return;
    }
    dispatch(
      draftSessionConfigOptionSelected({
        configId,
        provider: activeSession.provider,
        value,
      }),
    );
  }

  function handleProviderSelect(provider: ProviderId): void {
    selectDraftProvider(dispatch, provider);
  }

  const visibleConfigOptions =
    activeSession?.kind === "open"
      ? activeSession.configOptions
      : activeSession?.kind === "draft"
        ? draftProviderConfigOptions(activeSession, draftSnapshotEntry)
        : null;

  return renderSessionComposerSurface({
    activeSession,
    canSend,
    configOptions: visibleConfigOptions,
    draft,
    handleConfigOptionSelect,
    handleProviderSelect,
    handleSend,
    hasError:
      promptSessionState.isError ||
      newSessionState.isError ||
      setSessionConfigOptionState.isError ||
      providersConfigSnapshotError,
    isConfigUpdating: setSessionConfigOptionState.isLoading,
    setDraft,
    errorMessage:
      activeSession?.kind === "open" && activeSession.configSyncBlocked
        ? (activeSession.configSyncError ??
          "Session config sync failed. Update a config option before sending again.")
        : promptSessionState.isError ||
            newSessionState.isError ||
            setSessionConfigOptionState.isError ||
            providersConfigSnapshotError
          ? "Request failed"
          : null,
    theme,
  });
}

export { SessionComposer };
