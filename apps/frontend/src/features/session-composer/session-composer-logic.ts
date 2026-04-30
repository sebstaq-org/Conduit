import type {
  ProviderId,
  ProvidersConfigSnapshotResult,
  SessionConfigOption,
} from "@conduit/session-client";
import type { ActiveSession } from "@/app-state";

type ProviderConfigSnapshotEntry =
  ProvidersConfigSnapshotResult["entries"][number];

interface DraftSnapshotEntry {
  error: string | null;
  provider: ProviderId;
  status: ProviderConfigSnapshotEntry["status"];
  configOptions: SessionConfigOption[] | null;
}

function copyOptionWithCurrentValue(
  option: SessionConfigOption,
  currentValue: string,
): SessionConfigOption {
  return {
    id: option.id,
    name: option.name,
    description: option.description,
    category: option.category,
    type: option.type,
    currentValue,
    values: option.values,
  };
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
    return copyOptionWithCurrentValue(option, selected);
  });
}

function resolveDraftSnapshotEntry(
  activeSession: ActiveSession | null,
  providersConfigSnapshot: ProvidersConfigSnapshotResult | undefined,
): DraftSnapshotEntry | null {
  if (activeSession?.kind !== "draft" || activeSession.provider === null) {
    return null;
  }
  if (providersConfigSnapshot === undefined) {
    return null;
  }
  return (
    providersConfigSnapshot.entries.find(
      (entry) => entry.provider === activeSession.provider,
    ) ?? null
  );
}

function resolveDraftProviderReady(
  activeSession: ActiveSession | null,
  draftSnapshotEntry: DraftSnapshotEntry | null,
): boolean {
  if (activeSession?.kind !== "draft") {
    return true;
  }
  if (activeSession.provider === null) {
    return false;
  }
  return draftSnapshotEntry?.status === "ready";
}

function resolveVisibleConfigOptions(
  activeSession: ActiveSession | null,
  draftSnapshotEntry: DraftSnapshotEntry | null,
): SessionConfigOption[] | null {
  if (activeSession?.kind === "open") {
    return activeSession.configOptions;
  }
  if (activeSession?.kind !== "draft") {
    return null;
  }
  if (activeSession.provider === null || draftSnapshotEntry === null) {
    return null;
  }
  if (draftSnapshotEntry.status !== "ready") {
    return null;
  }
  return applyDraftSelectedConfigValues(
    draftSnapshotEntry.configOptions,
    activeSession.selectedConfigByProvider[activeSession.provider],
  );
}

function providerDisplayName(provider: ProviderId): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function draftProviderLoadFailureMessage(providerName: string): string {
  return `${providerName} settings failed to load.`;
}

function resolveDraftProviderEntryMessage(args: {
  draftSnapshotEntry: DraftSnapshotEntry;
  providerName: string;
}): string | null {
  if (args.draftSnapshotEntry.status === "loading") {
    return `Loading ${args.providerName} settings...`;
  }
  if (args.draftSnapshotEntry.status === "unavailable") {
    return `${args.providerName} is unavailable.`;
  }
  if (args.draftSnapshotEntry.status === "error") {
    return (
      args.draftSnapshotEntry.error ??
      draftProviderLoadFailureMessage(args.providerName)
    );
  }
  return null;
}

function resolveDraftProviderStatusMessage(args: {
  draftSnapshotEntry: DraftSnapshotEntry | null;
  providerName: string;
  providersConfigSnapshotError: boolean;
}): string | null {
  if (args.providersConfigSnapshotError) {
    return draftProviderLoadFailureMessage(args.providerName);
  }
  if (args.draftSnapshotEntry === null) {
    return `Loading ${args.providerName} settings...`;
  }
  return resolveDraftProviderEntryMessage({
    draftSnapshotEntry: args.draftSnapshotEntry,
    providerName: args.providerName,
  });
}

function resolveDraftProviderMessage(args: {
  activeSession: Extract<ActiveSession, { kind: "draft" }>;
  draftSnapshotEntry: DraftSnapshotEntry | null;
  providersConfigSnapshotError: boolean;
}): string | null {
  const provider = args.activeSession.provider;
  if (provider === null) {
    return null;
  }
  return resolveDraftProviderStatusMessage({
    draftSnapshotEntry: args.draftSnapshotEntry,
    providerName: providerDisplayName(provider),
    providersConfigSnapshotError: args.providersConfigSnapshotError,
  });
}

function resolveErrorMessage(args: {
  activeSession: ActiveSession | null;
  draftSnapshotEntry: DraftSnapshotEntry | null;
  newSessionError: boolean;
  promptError: boolean;
  providersConfigSnapshotError: boolean;
  setConfigError: boolean;
}): string | null {
  if (
    args.activeSession?.kind === "open" &&
    args.activeSession.configSyncBlocked
  ) {
    return (
      args.activeSession.configSyncError ??
      "Session config sync failed. Update a config option before sending again."
    );
  }
  if (args.activeSession?.kind === "draft") {
    return resolveDraftProviderMessage({
      activeSession: args.activeSession,
      draftSnapshotEntry: args.draftSnapshotEntry,
      providersConfigSnapshotError: args.providersConfigSnapshotError,
    });
  }
  if (
    args.promptError ||
    args.newSessionError ||
    args.setConfigError ||
    args.providersConfigSnapshotError
  ) {
    return "Request failed";
  }
  return null;
}

function resolveSessionComposerWorking(args: {
  activeSession: ActiveSession | null;
  newSessionLoading: boolean;
  promptSessionLoading: boolean;
}): boolean {
  if (args.activeSession?.kind === "draft") {
    return args.newSessionLoading || args.promptSessionLoading;
  }
  if (args.activeSession?.kind === "open") {
    return args.promptSessionLoading;
  }
  return false;
}

export type { DraftSnapshotEntry };
export {
  resolveDraftProviderReady,
  resolveDraftSnapshotEntry,
  resolveErrorMessage,
  resolveDraftProviderMessage,
  resolveSessionComposerWorking,
  resolveVisibleConfigOptions,
};
