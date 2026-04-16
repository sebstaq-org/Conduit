import { PROVIDERS as PROTOCOL_PROVIDERS } from "@conduit/app-protocol";

const PROVIDERS = [...PROTOCOL_PROVIDERS] as const;

type ProviderId = (typeof PROVIDERS)[number];
type SessionConfigOptionCategory = string | null;
type TranscriptItemStatus = "complete" | "streaming" | "cancelled" | "failed";

interface TranscriptTextPart {
  kind: "text";
  text: string;
}

interface TranscriptUnsupportedPart {
  kind: "unsupported";
  type: string;
}

type TranscriptContentPart = TranscriptTextPart | TranscriptUnsupportedPart;

interface GlobalSettingsView {
  sessionGroupsUpdatedWithinDays: number | null;
}

interface ProjectRow {
  cwd: string;
  displayName: string;
  projectId: string;
}

interface ProjectSuggestion {
  cwd: string;
  suggestionId: string;
}

interface ProjectListView {
  projects: ProjectRow[];
}

interface ProjectSuggestionsView {
  suggestions: ProjectSuggestion[];
}

interface SessionRow {
  provider: ProviderId;
  sessionId: string;
  title: string | null;
  updatedAt: string | null;
}

interface SessionGroup {
  cwd: string;
  displayName: string;
  groupId: string;
  sessions: SessionRow[];
}

interface SessionGroupsView {
  groups: SessionGroup[];
  isRefreshing: boolean;
  refreshedAt: string | null;
  revision: number;
}

interface SessionConfigOptionValue {
  description: string | null;
  kind: "value";
  name: string;
  value: string;
}

interface SessionConfigOptionGroup {
  group: string;
  kind: "group";
  name: string;
  options: SessionConfigOptionValue[];
}

type SessionConfigOptionEntry =
  | SessionConfigOptionValue
  | SessionConfigOptionGroup;

interface SessionConfigOption {
  category: SessionConfigOptionCategory;
  currentValue: string;
  description: string | null;
  id: string;
  name: string;
  options: SessionConfigOptionEntry[];
  type: "select";
}

interface MessageTranscriptItem {
  content: TranscriptContentPart[];
  id: string;
  kind: "message";
  role: "user" | "agent";
  status?: TranscriptItemStatus | null;
  stopReason?: string | null;
  turnId?: string | null;
}

interface EventTranscriptItem {
  data: Record<string, unknown>;
  id: string;
  kind: "event";
  status?: TranscriptItemStatus | null;
  stopReason?: string | null;
  turnId?: string | null;
  variant: string;
}

type TranscriptItem = MessageTranscriptItem | EventTranscriptItem;

interface SessionHistoryWindow {
  items: TranscriptItem[];
  nextCursor: string | null;
  openSessionId: string;
  revision: number;
}

interface SessionNewResult {
  configOptions: SessionConfigOption[] | null;
  history: SessionHistoryWindow;
  models: unknown;
  modes: unknown;
  sessionId: string;
}

interface SessionOpenResult {
  configOptions: SessionConfigOption[] | null;
  items: TranscriptItem[];
  models: unknown;
  modes: unknown;
  nextCursor: string | null;
  openSessionId: string;
  revision: number;
  sessionId: string;
}

interface SessionSetConfigOptionResult {
  configOptions: SessionConfigOption[];
  sessionId: string;
}

type ProviderConfigSnapshotStatus =
  | "loading"
  | "ready"
  | "error"
  | "unavailable";

interface ProviderConfigSnapshotEntry {
  configOptions: SessionConfigOption[] | null;
  error: string | null;
  fetchedAt: string | null;
  models: unknown;
  modes: unknown;
  provider: ProviderId;
  status: ProviderConfigSnapshotStatus;
}

interface ProvidersConfigSnapshotResult {
  entries: ProviderConfigSnapshotEntry[];
}

interface SessionTimelineChanged {
  items?: TranscriptItem[];
  openSessionId: string;
  revision: number;
}

interface SessionsIndexChanged {
  revision: number;
}

export { PROVIDERS };
export type {
  EventTranscriptItem,
  GlobalSettingsView,
  MessageTranscriptItem,
  ProjectListView,
  ProjectRow,
  ProjectSuggestion,
  ProjectSuggestionsView,
  ProviderConfigSnapshotEntry,
  ProviderConfigSnapshotStatus,
  ProviderId,
  ProvidersConfigSnapshotResult,
  SessionConfigOption,
  SessionConfigOptionCategory,
  SessionConfigOptionEntry,
  SessionConfigOptionGroup,
  SessionConfigOptionValue,
  SessionGroup,
  SessionGroupsView,
  SessionHistoryWindow,
  SessionNewResult,
  SessionOpenResult,
  SessionRow,
  SessionSetConfigOptionResult,
  SessionTimelineChanged,
  SessionsIndexChanged,
  TranscriptContentPart,
  TranscriptItem,
  TranscriptTextPart,
  TranscriptItemStatus,
  TranscriptUnsupportedPart,
};
