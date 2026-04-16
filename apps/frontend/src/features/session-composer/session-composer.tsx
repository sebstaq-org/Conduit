import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import type {
  ProviderId,
  ProvidersConfigSnapshotResult,
} from "@conduit/session-client";
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
import type {
  ActiveSession,
  SessionComposerPlanInteractionController,
} from "@/app-state";
import type { Theme } from "@/theme";
import { SessionComposerSurface } from "./session-composer-surface";
import {
  resolveDraftProviderReady,
  resolveDraftSnapshotEntry,
  resolveErrorMessage,
  resolveVisibleConfigOptions,
} from "./session-composer-logic";

interface SessionComposerController {
  activeSession: ActiveSession | null;
  canSend: boolean;
  configOptions: ReturnType<typeof resolveVisibleConfigOptions>;
  draft: string;
  errorMessage: string | null;
  handleConfigOptionSelect: (configId: string, value: string) => void;
  handleProviderSelect: (provider: ProviderId) => void;
  handleSend: () => void;
  isConfigUpdating: boolean;
  setDraft: (draft: string) => void;
}

interface SessionComposerRuntime {
  activeSession: ActiveSession | null;
  dispatch: ReturnType<typeof useDispatch>;
  newSession: ReturnType<typeof useNewSessionMutation>[0];
  newSessionError: boolean;
  newSessionLoading: boolean;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  promptSession: ReturnType<typeof usePromptSessionMutation>[0];
  promptSessionError: boolean;
  promptSessionLoading: boolean;
  providersConfigSnapshot: ProvidersConfigSnapshotResult | undefined;
  providersConfigSnapshotError: boolean;
  setSessionConfigOption: ReturnType<
    typeof useSetSessionConfigOptionMutation
  >[0];
  setSessionConfigOptionError: boolean;
  setSessionConfigOptionLoading: boolean;
}

interface SessionComposerProps {
  planInteraction: SessionComposerPlanInteractionController;
}

function createDraftCommitCallback(args: {
  activeSession: ActiveSession;
  dispatch: ReturnType<typeof useDispatch>;
}): Parameters<typeof submitPrompt>[0]["onDraftPromptCommitted"] {
  return (session): void => {
    args.dispatch(
      activeSessionOpened({
        configOptions: session.configOptions,
        configSyncBlocked: session.configSyncBlocked,
        configSyncError: session.configSyncError,
        cwd: args.activeSession.cwd,
        kind: "open",
        modes: session.modes,
        models: session.models,
        openSessionId: session.openSessionId,
        provider: session.provider,
        sessionId: session.sessionId,
        title: null,
      }),
    );
    void args.dispatch(
      conduitApi.util.invalidateTags([{ id: "LIST", type: "SessionGroups" }]),
    );
  };
}

function createHandleSend(args: {
  activeSession: ActiveSession | null;
  canSend: boolean;
  dispatch: ReturnType<typeof useDispatch>;
  newSession: ReturnType<typeof useNewSessionMutation>[0];
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  promptSession: ReturnType<typeof usePromptSessionMutation>[0];
  setDraft: (draft: string) => void;
  setSessionConfigOption: ReturnType<
    typeof useSetSessionConfigOptionMutation
  >[0];
  text: string;
}): () => void {
  return (): void => {
    if (!args.canSend || args.activeSession === null) {
      return;
    }
    const activeSession = args.activeSession;
    void submitPrompt({
      activeSession,
      newSession: args.newSession,
      openSession: args.openSession,
      onDraftPromptCommitted: createDraftCommitCallback({
        activeSession,
        dispatch: args.dispatch,
      }),
      promptSession: args.promptSession,
      setSessionConfigOption: args.setSessionConfigOption,
      setDraft: args.setDraft,
      text: args.text,
    });
  };
}

function createHandleConfigOptionSelect(args: {
  activeSession: ActiveSession | null;
  dispatch: ReturnType<typeof useDispatch>;
  setSessionConfigOption: ReturnType<
    typeof useSetSessionConfigOptionMutation
  >[0];
}): (configId: string, value: string) => void {
  return (configId: string, value: string): void => {
    if (args.activeSession?.kind === "open") {
      void args.setSessionConfigOption({
        configId,
        provider: args.activeSession.provider,
        sessionId: args.activeSession.sessionId,
        value,
      });
      return;
    }
    if (
      args.activeSession?.kind !== "draft" ||
      args.activeSession.provider === null
    ) {
      return;
    }
    args.dispatch(
      draftSessionConfigOptionSelected({
        configId,
        provider: args.activeSession.provider,
        value,
      }),
    );
  };
}

function createHandleProviderSelect(
  dispatch: ReturnType<typeof useDispatch>,
): (provider: ProviderId) => void {
  return (provider: ProviderId): void => {
    dispatch(draftSessionProviderSelected(provider));
  };
}

function buildSessionComposerController(args: {
  canSend: boolean;
  draft: string;
  draftSnapshotEntry: ReturnType<typeof resolveDraftSnapshotEntry>;
  runtime: SessionComposerRuntime;
  setDraft: (draft: string) => void;
  trimmedDraft: string;
}): SessionComposerController {
  return {
    activeSession: args.runtime.activeSession,
    canSend: args.canSend,
    configOptions: resolveVisibleConfigOptions(
      args.runtime.activeSession,
      args.draftSnapshotEntry,
    ),
    draft: args.draft,
    errorMessage: resolveErrorMessage({
      activeSession: args.runtime.activeSession,
      newSessionError: args.runtime.newSessionError,
      promptError: args.runtime.promptSessionError,
      providersConfigSnapshotError: args.runtime.providersConfigSnapshotError,
      setConfigError: args.runtime.setSessionConfigOptionError,
    }),
    handleConfigOptionSelect: createHandleConfigOptionSelect({
      activeSession: args.runtime.activeSession,
      dispatch: args.runtime.dispatch,
      setSessionConfigOption: args.runtime.setSessionConfigOption,
    }),
    handleProviderSelect: createHandleProviderSelect(args.runtime.dispatch),
    handleSend: createHandleSend({
      activeSession: args.runtime.activeSession,
      canSend: args.canSend,
      dispatch: args.runtime.dispatch,
      newSession: args.runtime.newSession,
      openSession: args.runtime.openSession,
      promptSession: args.runtime.promptSession,
      setDraft: args.setDraft,
      setSessionConfigOption: args.runtime.setSessionConfigOption,
      text: args.trimmedDraft,
    }),
    isConfigUpdating: args.runtime.setSessionConfigOptionLoading,
    setDraft: args.setDraft,
  };
}

function useSessionComposerRuntime(): SessionComposerRuntime {
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
  return {
    activeSession,
    dispatch,
    newSession,
    newSessionError: newSessionState.isError,
    newSessionLoading: newSessionState.isLoading,
    openSession,
    promptSession,
    promptSessionError: promptSessionState.isError,
    promptSessionLoading: promptSessionState.isLoading,
    providersConfigSnapshot,
    providersConfigSnapshotError,
    setSessionConfigOption,
    setSessionConfigOptionError: setSessionConfigOptionState.isError,
    setSessionConfigOptionLoading: setSessionConfigOptionState.isLoading,
  };
}

function useSessionComposerController(): SessionComposerController {
  const runtime = useSessionComposerRuntime();
  const [draft, setDraft] = useState("");
  const trimmedDraft = draft.trim();
  const draftSnapshotEntry = resolveDraftSnapshotEntry(
    runtime.activeSession,
    runtime.providersConfigSnapshot,
  );
  const canSend = canSubmitPrompt({
    activeSession: runtime.activeSession,
    draftProviderReady: resolveDraftProviderReady(
      runtime.activeSession,
      draftSnapshotEntry,
    ),
    isLoading: runtime.promptSessionLoading || runtime.newSessionLoading,
    openSessionConfigSyncBlocked:
      runtime.activeSession?.kind === "open" &&
      runtime.activeSession.configSyncBlocked,
    text: trimmedDraft,
  });
  return buildSessionComposerController({
    canSend,
    draft,
    draftSnapshotEntry,
    runtime,
    setDraft,
    trimmedDraft,
  });
}

function SessionComposer({
  planInteraction,
}: SessionComposerProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const controller = useSessionComposerController();
  return (
    <SessionComposerSurface
      activeSession={controller.activeSession}
      canSend={controller.canSend}
      configOptions={controller.configOptions}
      draft={controller.draft}
      errorMessage={controller.errorMessage}
      onConfigOptionSelect={controller.handleConfigOptionSelect}
      onProviderSelect={controller.handleProviderSelect}
      onSend={controller.handleSend}
      isConfigUpdating={controller.isConfigUpdating}
      planInteractionActions={planInteraction.actions}
      planInteractionView={planInteraction.view}
      setDraft={controller.setDraft}
      theme={theme}
    />
  );
}
export { SessionComposer };
