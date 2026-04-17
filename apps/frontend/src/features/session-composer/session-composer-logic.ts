import type {
  ProvidersConfigSnapshotResult,
  SessionConfigOption,
} from "@conduit/session-client";
import type { ActiveSession } from "@/app-state";

interface DraftSnapshotEntry {
  status: string;
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

function resolveErrorMessage(args: {
  activeSession: ActiveSession | null;
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

export type { DraftSnapshotEntry };
export {
  resolveDraftProviderReady,
  resolveDraftSnapshotEntry,
  resolveErrorMessage,
  resolveVisibleConfigOptions,
};
