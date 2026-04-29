import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import type {
  ProviderId,
  ProvidersConfigSnapshotResult,
} from "@conduit/session-client";
import { useDispatch, useSelector } from "react-redux";
import {
  canSubmitPrompt,
  draftSessionConfigOptionSelected,
  selectActiveSession,
  useGetProvidersConfigSnapshotQuery,
  useNewSessionMutation,
  useOpenSessionMutation,
  usePromptSessionMutation,
  useSetSessionConfigOptionMutation,
} from "@/app-state";
import type {
  ActiveSession,
  AppDispatch,
  SessionComposerPlanInteractionController,
} from "@/app-state";
import type { Theme } from "@/theme";
import { SessionComposerSurface } from "./session-composer-surface";
import {
  resolveDraftProviderReady,
  resolveDraftSnapshotEntry,
  resolveErrorMessage,
  resolveSessionComposerWorking,
  resolveVisibleConfigOptions,
} from "./session-composer-logic";
import {
  createHandleProviderSelect,
  providerConfigPollingInterval,
  useActiveSessionTimelineRevision,
} from "./session-composer-provider-config-refresh";
import { createSessionComposerSendHandler } from "./session-composer-submit";

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
  isWorking: boolean;
  setDraft: (draft: string) => void;
}
interface SessionComposerRuntime {
  activeSession: ActiveSession | null;
  dispatch: AppDispatch;
  newSession: ReturnType<typeof useNewSessionMutation>[0];
  newSessionError: boolean;
  newSessionLoading: boolean;
  openSessionBaseRevision: number | null;
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

function createHandleConfigOptionSelect(args: {
  activeSession: ActiveSession | null;
  dispatch: AppDispatch;
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

function isSessionPromptBusy(runtime: SessionComposerRuntime): boolean {
  return resolveSessionComposerWorking({
    activeSession: runtime.activeSession,
    newSessionLoading: runtime.newSessionLoading,
    promptSessionLoading: runtime.promptSessionLoading,
  });
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
      draftSnapshotEntry: args.draftSnapshotEntry,
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
    handleSend: createSessionComposerSendHandler({
      activeSession: args.runtime.activeSession,
      canSend: args.canSend,
      dispatch: args.runtime.dispatch,
      newSession: args.runtime.newSession,
      openSessionBaseRevision: args.runtime.openSessionBaseRevision,
      openSession: args.runtime.openSession,
      promptSession: args.runtime.promptSession,
      setDraft: args.setDraft,
      setSessionConfigOption: args.runtime.setSessionConfigOption,
      text: args.trimmedDraft,
    }),
    isConfigUpdating: args.runtime.setSessionConfigOptionLoading,
    isWorking: isSessionPromptBusy(args.runtime),
    setDraft: args.setDraft,
  };
}

function useSessionComposerRuntime(): SessionComposerRuntime {
  const dispatch = useDispatch<AppDispatch>();
  const activeSession = useSelector(selectActiveSession);
  const [newSession, newSessionState] = useNewSessionMutation();
  const [openSession] = useOpenSessionMutation();
  const [promptSession, promptSessionState] = usePromptSessionMutation();
  const [setSessionConfigOption, setSessionConfigOptionState] =
    useSetSessionConfigOptionMutation();
  const openSessionBaseRevision =
    useActiveSessionTimelineRevision(activeSession);
  const {
    data: providersConfigSnapshot,
    isError: providersConfigSnapshotError,
  } = useGetProvidersConfigSnapshotQuery(null, {
    pollingInterval: providerConfigPollingInterval(activeSession),
    refetchOnMountOrArgChange: true,
    skipPollingIfUnfocused: true,
  });
  return {
    activeSession,
    dispatch,
    newSession,
    newSessionError: newSessionState.isError,
    newSessionLoading: newSessionState.isLoading,
    openSessionBaseRevision,
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
    isLoading: isSessionPromptBusy(runtime),
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
}: {
  planInteraction: SessionComposerPlanInteractionController;
}): React.JSX.Element {
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
      isWorking={controller.isWorking}
      setDraft={controller.setDraft}
      theme={theme}
    />
  );
}
export { SessionComposer };
