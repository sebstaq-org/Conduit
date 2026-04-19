import {
  createRelaySessionClient,
  createSessionClient,
} from "@conduit/session-client";
import { relayOfferFromHostProfile } from "@conduit/app-client";
import type { ConnectionHostProfile } from "@conduit/app-client";
import type {
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  SessionClientPort,
  SessionClientTelemetryEvent,
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "@conduit/session-client";
import type {
  ConsumerResponse,
  ProvidersConfigSnapshotResult,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionNewRequest,
  SessionNewResult,
  SessionOpenRequest,
  SessionOpenResult,
  SessionPromptRequest,
  SessionRespondInteractionRequest,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
} from "@conduit/session-contracts";
import type {
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
} from "@conduit/session-model";
import { frontendEnvValue } from "./frontend-env";
import { logDebug, logError, logInfo, logWarn } from "./frontend-logger";

function optionalSessionClientUrl(): string | null {
  const configuredUrl = frontendEnvValue("EXPO_PUBLIC_CONDUIT_SESSION_WS_URL");
  if (configuredUrl === undefined) {
    return null;
  }
  const url = configuredUrl.trim();
  if (url.length === 0) {
    throw new Error(
      "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL must not be empty for frontend session transport.",
    );
  }
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    throw new Error(
      "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL must start with ws:// or wss://.",
    );
  }
  return url;
}

function configuredSessionHealthUrl(): string | null {
  const configuredUrl = optionalSessionClientUrl();
  if (configuredUrl === null) {
    return null;
  }
  const wsUrl = new URL(configuredUrl);
  const protocolByWebSocketScheme: Record<string, string> = {
    "ws:": "http:",
    "wss:": "https:",
  };
  wsUrl.protocol = protocolByWebSocketScheme[wsUrl.protocol] ?? "http:";
  wsUrl.pathname = "/health";
  wsUrl.search = "";
  wsUrl.hash = "";
  return wsUrl.toString();
}

function logSessionClientTelemetry(event: SessionClientTelemetryEvent): void {
  if (event.level === "debug") {
    logDebug(event.event_name, event.fields ?? {});
    return;
  }
  if (event.level === "info") {
    logInfo(event.event_name, event.fields ?? {});
    return;
  }
  if (event.level === "warn") {
    logWarn(event.event_name, event.fields ?? {});
    return;
  }
  logError(event.event_name, event.fields ?? {});
}

function unconfiguredError(): Error {
  return new Error("Pair a desktop before using Conduit sessions.");
}

async function rejectUnconfigured<Result>(): Promise<Result> {
  await Promise.resolve();
  throw unconfiguredError();
}

function createUnconfiguredSessionClient(): SessionClientPort {
  return {
    addProject: rejectUnconfigured,
    getProjectSuggestions: rejectUnconfigured,
    getProvidersConfigSnapshot: rejectUnconfigured,
    getSessionGroups: rejectUnconfigured,
    getSettings: rejectUnconfigured,
    listProjects: rejectUnconfigured,
    newSession: rejectUnconfigured,
    openSession: rejectUnconfigured,
    policy: "official-acp-only" as const,
    promptSession: rejectUnconfigured,
    readSessionHistory: rejectUnconfigured,
    removeProject: rejectUnconfigured,
    respondInteraction: rejectUnconfigured,
    setSessionConfigOption: rejectUnconfigured,
    subscribeSessionIndexChanges: rejectUnconfigured,
    subscribeTimelineChanges: rejectUnconfigured,
    updateProject: rejectUnconfigured,
    updateSettings: rejectUnconfigured,
  };
}

class SessionClientManager implements SessionClientPort {
  public readonly policy = "official-acp-only" as const;
  private client: SessionClientPort = createUnconfiguredSessionClient();

  public configureDirect(url: string): void {
    this.client = createSessionClient({
      onTelemetryEvent: logSessionClientTelemetry,
      url,
    });
  }

  public configureRelay(host: ConnectionHostProfile): void {
    this.client = createRelaySessionClient({
      offer: relayOfferFromHostProfile(host),
      onTelemetryEvent: logSessionClientTelemetry,
    });
  }

  public configureUnconfigured(): void {
    this.client = createUnconfiguredSessionClient();
  }

  public async addProject(request: ProjectAddRequest): Promise<ProjectListView> {
    const result = await this.client.addProject(request);
    return result;
  }

  public async getProjectSuggestions(
    query?: ProjectSuggestionsQuery,
  ): Promise<ProjectSuggestionsView> {
    const result = await this.client.getProjectSuggestions(query);
    return result;
  }

  public async getSettings(): Promise<GlobalSettingsView> {
    const result = await this.client.getSettings();
    return result;
  }

  public async getSessionGroups(
    query?: SessionGroupsQuery,
  ): Promise<SessionGroupsView> {
    const result = await this.client.getSessionGroups(query);
    return result;
  }

  public async getProvidersConfigSnapshot(): Promise<ProvidersConfigSnapshotResult> {
    const result = await this.client.getProvidersConfigSnapshot();
    return result;
  }

  public async listProjects(): Promise<ProjectListView> {
    const result = await this.client.listProjects();
    return result;
  }

  public async openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionOpenResult | null>> {
    const result = await this.client.openSession(provider, request);
    return result;
  }

  public async newSession(
    provider: ProviderId,
    request: SessionNewRequest,
  ): Promise<ConsumerResponse<SessionNewResult | null>> {
    const result = await this.client.newSession(provider, request);
    return result;
  }

  public async setSessionConfigOption(
    provider: ProviderId,
    request: SessionSetConfigOptionRequest,
  ): Promise<ConsumerResponse<SessionSetConfigOptionResult | null>> {
    const result = await this.client.setSessionConfigOption(provider, request);
    return result;
  }

  public async readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>> {
    const result = await this.client.readSessionHistory(request);
    return result;
  }

  public async promptSession(request: SessionPromptRequest): Promise<void> {
    await this.client.promptSession(request);
  }

  public async respondInteraction(
    request: SessionRespondInteractionRequest,
  ): Promise<void> {
    await this.client.respondInteraction(request);
  }

  public async removeProject(
    request: ProjectRemoveRequest,
  ): Promise<ProjectListView> {
    const result = await this.client.removeProject(request);
    return result;
  }

  public async updateProject(
    request: ProjectUpdateRequest,
  ): Promise<ProjectListView> {
    const result = await this.client.updateProject(request);
    return result;
  }

  public async updateSettings(
    request: GlobalSettingsUpdateRequest,
  ): Promise<GlobalSettingsView> {
    const result = await this.client.updateSettings(request);
    return result;
  }

  public async subscribeTimelineChanges(
    openSessionId: string,
    handler: (event: SessionTimelineChanged) => void,
  ): Promise<() => void> {
    const result = await this.client.subscribeTimelineChanges(openSessionId, handler);
    return result;
  }

  public async subscribeSessionIndexChanges(
    handler: (event: SessionsIndexChanged) => void,
  ): Promise<() => void> {
    const result = await this.client.subscribeSessionIndexChanges(handler);
    return result;
  }
}

const sessionClientManager = new SessionClientManager();
const directUrl = optionalSessionClientUrl();
if (directUrl !== null) {
  sessionClientManager.configureDirect(directUrl);
}

function configureSessionClientForHost(
  host: ConnectionHostProfile | null,
): void {
  if (host !== null) {
    sessionClientManager.configureRelay(host);
    return;
  }
  const url = optionalSessionClientUrl();
  if (url !== null) {
    sessionClientManager.configureDirect(url);
    return;
  }
  sessionClientManager.configureUnconfigured();
}

const sessionClient: SessionClientPort = sessionClientManager;

export {
  configureSessionClientForHost,
  configuredSessionHealthUrl,
  sessionClient,
};
export type { SessionClientPort };
