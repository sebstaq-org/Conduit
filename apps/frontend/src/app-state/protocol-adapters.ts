import type {
  GlobalSettingsView as ProtocolGlobalSettingsView,
  ProjectListView as ProtocolProjectListView,
  ProjectSuggestionsView as ProtocolProjectSuggestionsView,
  ProvidersConfigSnapshotResult as ProtocolProvidersConfigSnapshotResult,
  SessionGroupsView as ProtocolSessionGroupsView,
  SessionHistoryWindow as ProtocolSessionHistoryWindow,
  SessionNewResult as ProtocolSessionNewResult,
  SessionOpenResult as ProtocolSessionOpenResult,
  SessionSetConfigOptionResult as ProtocolSessionSetConfigOptionResult,
} from "@conduit/app-protocol";
import type {
  GlobalSettingsView,
  ProjectListView,
  ProjectSuggestionsView,
  ProvidersConfigSnapshotResult,
  SessionConfigOption,
  SessionConfigOptionGroup,
  SessionConfigOptionValue,
  SessionGroupsView,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  SessionSetConfigOptionResult,
} from "./models";
import { mapTranscriptItem } from "./transcript-protocol-adapters";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(value: unknown, field: string): string {
  if (!isRecord(value) || typeof value[field] !== "string") {
    throw new Error(`Expected string field ${field}`);
  }
  return value[field];
}

function readNullableString(value: unknown, field: string): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const fieldValue = value[field];
  if (typeof fieldValue === "string") {
    return fieldValue;
  }
  return null;
}

function normalizeUnknown(value: unknown): unknown {
  return value ?? null;
}

function mapSessionConfigOptionValue(value: unknown): SessionConfigOptionValue {
  return {
    description: readNullableString(value, "description"),
    kind: "value",
    name: readRequiredString(value, "name"),
    value: readRequiredString(value, "value"),
  };
}

function mapSessionConfigOptionGroup(value: unknown): SessionConfigOptionGroup {
  if (!isRecord(value) || !Array.isArray(value.options)) {
    throw new Error("Expected grouped session config option values");
  }
  return {
    group: readRequiredString(value, "group"),
    kind: "group",
    name: readRequiredString(value, "name"),
    options: value.options.map((entry) => mapSessionConfigOptionValue(entry)),
  };
}

function mapSessionConfigOptionEntry(
  value: unknown,
): SessionConfigOptionValue | SessionConfigOptionGroup {
  if (isRecord(value) && typeof value.group === "string") {
    return mapSessionConfigOptionGroup(value);
  }
  return mapSessionConfigOptionValue(value);
}

function mapSessionConfigOption(option: unknown): SessionConfigOption {
  if (!isRecord(option) || !Array.isArray(option.options)) {
    throw new Error("Expected session config option with selectable options");
  }
  if (option.type !== "select") {
    throw new Error("Unsupported session config option type");
  }
  return {
    category: readNullableString(option, "category"),
    currentValue: readRequiredString(option, "currentValue"),
    description: readNullableString(option, "description"),
    id: readRequiredString(option, "id"),
    name: readRequiredString(option, "name"),
    options: option.options.map((value) => mapSessionConfigOptionEntry(value)),
    type: "select",
  };
}

function mapSessionConfigOptions(
  options: unknown,
): SessionConfigOption[] | null {
  if (options === undefined || options === null) {
    return null;
  }
  if (!Array.isArray(options)) {
    throw new TypeError("Expected session config option array");
  }
  return options.map((option) => mapSessionConfigOption(option));
}

function mapSessionHistoryWindow(
  history: ProtocolSessionHistoryWindow,
): SessionHistoryWindow {
  return {
    items: history.items.map((item) => mapTranscriptItem(item)),
    nextCursor: history.nextCursor ?? null,
    openSessionId: history.openSessionId,
    revision: history.revision,
  };
}

function mapSessionNewResult(
  result: ProtocolSessionNewResult,
): SessionNewResult {
  return {
    configOptions: mapSessionConfigOptions(result.configOptions),
    history: mapSessionHistoryWindow(result.history),
    models: normalizeUnknown(result.models),
    modes: normalizeUnknown(result.modes),
    sessionId: result.sessionId,
  };
}

function mapSessionOpenResult(
  result: ProtocolSessionOpenResult,
): SessionOpenResult {
  return {
    configOptions: mapSessionConfigOptions(result.configOptions),
    items: result.items.map((item) => mapTranscriptItem(item)),
    models: normalizeUnknown(result.models),
    modes: normalizeUnknown(result.modes),
    nextCursor: result.nextCursor ?? null,
    openSessionId: result.openSessionId,
    revision: result.revision,
    sessionId: result.sessionId,
  };
}

function mapSessionSetConfigOptionResult(
  result: ProtocolSessionSetConfigOptionResult,
): SessionSetConfigOptionResult {
  return {
    configOptions: mapSessionConfigOptions(result.configOptions) ?? [],
    sessionId: result.sessionId,
  };
}

function mapProvidersConfigSnapshotResult(
  result: ProtocolProvidersConfigSnapshotResult,
): ProvidersConfigSnapshotResult {
  return {
    entries: result.entries.map((entry) => ({
      configOptions: mapSessionConfigOptions(entry.configOptions),
      error: readNullableString(entry, "error"),
      fetchedAt: readNullableString(entry, "fetchedAt"),
      models: normalizeUnknown(entry.models),
      modes: normalizeUnknown(entry.modes),
      provider: entry.provider,
      status: entry.status,
    })),
  };
}

function mapSessionGroupsView(
  view: ProtocolSessionGroupsView,
): SessionGroupsView {
  return {
    groups: view.groups.map((group) => ({
      cwd: group.cwd,
      displayName: group.displayName,
      groupId: group.groupId,
      sessions: group.sessions.map((session) => ({
        provider: session.provider,
        sessionId: session.sessionId,
        title: session.title ?? null,
        updatedAt: session.updatedAt ?? null,
      })),
    })),
    isRefreshing: view.isRefreshing,
    refreshedAt: view.refreshedAt ?? null,
    revision: view.revision,
  };
}

function mapGlobalSettingsView(
  view: ProtocolGlobalSettingsView,
): GlobalSettingsView {
  return {
    sessionGroupsUpdatedWithinDays: view.sessionGroupsUpdatedWithinDays ?? null,
  };
}

function mapProjectListView(view: ProtocolProjectListView): ProjectListView {
  return {
    projects: view.projects.map((project) => ({
      cwd: project.cwd,
      displayName: project.displayName,
      projectId: project.projectId,
    })),
  };
}

function mapProjectSuggestionsView(
  view: ProtocolProjectSuggestionsView,
): ProjectSuggestionsView {
  return {
    suggestions: view.suggestions.map((suggestion) => ({
      cwd: suggestion.cwd,
      suggestionId: suggestion.suggestionId,
    })),
  };
}

export {
  mapGlobalSettingsView,
  mapProjectListView,
  mapProjectSuggestionsView,
  mapProvidersConfigSnapshotResult,
  mapSessionConfigOption,
  mapSessionConfigOptions,
  mapSessionGroupsView,
  mapSessionHistoryWindow,
  mapSessionNewResult,
  mapSessionOpenResult,
  mapSessionSetConfigOptionResult,
};
