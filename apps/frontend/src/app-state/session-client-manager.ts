import {
  createRelaySessionClient,
  createSessionClient,
} from "@conduit/session-client";
import { relayOfferFromHostProfile } from "@conduit/app-client";
import type { ConnectionHostProfile } from "@conduit/app-client";
import type {
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  PresenceUpdateRequest,
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

const presenceRefreshIntervalMs = 15_000;

class SessionClientManager implements SessionClientPort {
  public readonly policy = "official-acp-only" as const;
  private client: SessionClientPort;
  private configurationRevision = 0;
  private lastPresenceUpdateMs = 0;
  private presence: PresenceUpdateRequest | null = null;
  private presenceUpdateInFlight: Promise<void> | null = null;

  public constructor(client: SessionClientPort) {
    this.client = client;
  }

  public configureDirect(
    url: string,
    onTelemetryEvent: (event: SessionClientTelemetryEvent) => void,
  ): number {
    this.client.close();
    this.client = createSessionClient({ onTelemetryEvent, url });
    this.resetPresence();
    return this.bumpConfigurationRevision();
  }

  public configureRelay(
    host: ConnectionHostProfile,
    onTelemetryEvent: (event: SessionClientTelemetryEvent) => void,
  ): number {
    this.client.close();
    const relayTelemetry = (event: SessionClientTelemetryEvent): void => {
      if (
        event.event_name === "session_client.relay.socket.closed" ||
        event.event_name === "session_client.relay.socket.connect.finish"
      ) {
        this.lastPresenceUpdateMs = 0;
      }
      onTelemetryEvent(event);
    };
    this.client = createRelaySessionClient({
      offer: relayOfferFromHostProfile(host),
      onTelemetryEvent: relayTelemetry,
    });
    this.resetPresence();
    return this.bumpConfigurationRevision();
  }

  public configureUnconfigured(client: SessionClientPort): number {
    this.client.close();
    this.client = client;
    this.resetPresence();
    return this.bumpConfigurationRevision();
  }

  public close(): void {
    this.client.close();
  }

  public configurePresence(
    revision: number,
    request: PresenceUpdateRequest,
  ): void {
    if (revision !== this.configurationRevision) {
      return;
    }
    this.presence = request;
    this.lastPresenceUpdateMs = 0;
  }

  public async addProject(
    request: ProjectAddRequest,
  ): Promise<ProjectListView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.addProject(request);
    return result;
  }

  public async getProjectSuggestions(
    query?: ProjectSuggestionsQuery,
  ): Promise<ProjectSuggestionsView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.getProjectSuggestions(query);
    return result;
  }

  public async getSettings(): Promise<GlobalSettingsView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.getSettings();
    return result;
  }

  public async getSessionGroups(
    query?: SessionGroupsQuery,
  ): Promise<SessionGroupsView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.getSessionGroups(query);
    return result;
  }

  public async getProvidersConfigSnapshot(): Promise<ProvidersConfigSnapshotResult> {
    await this.refreshPresenceIfDue();
    const result = await this.client.getProvidersConfigSnapshot();
    return result;
  }

  public async listProjects(): Promise<ProjectListView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.listProjects();
    return result;
  }

  public async openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionOpenResult | null>> {
    await this.refreshPresenceIfDue();
    const result = await this.client.openSession(provider, request);
    return result;
  }

  public async newSession(
    provider: ProviderId,
    request: SessionNewRequest,
  ): Promise<ConsumerResponse<SessionNewResult | null>> {
    await this.refreshPresenceIfDue();
    const result = await this.client.newSession(provider, request);
    return result;
  }

  public async setSessionConfigOption(
    provider: ProviderId,
    request: SessionSetConfigOptionRequest,
  ): Promise<ConsumerResponse<SessionSetConfigOptionResult | null>> {
    await this.refreshPresenceIfDue();
    const result = await this.client.setSessionConfigOption(provider, request);
    return result;
  }

  public async readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>> {
    await this.refreshPresenceIfDue();
    const result = await this.client.readSessionHistory(request);
    return result;
  }

  public async promptSession(request: SessionPromptRequest): Promise<void> {
    await this.refreshPresenceIfDue();
    await this.client.promptSession(request);
  }

  public async respondInteraction(
    request: SessionRespondInteractionRequest,
  ): Promise<void> {
    await this.refreshPresenceIfDue();
    await this.client.respondInteraction(request);
  }

  public async removeProject(
    request: ProjectRemoveRequest,
  ): Promise<ProjectListView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.removeProject(request);
    return result;
  }

  public async updatePresence(request: PresenceUpdateRequest): Promise<void> {
    await this.client.updatePresence(request);
    this.lastPresenceUpdateMs = Date.now();
  }

  public async updateProject(
    request: ProjectUpdateRequest,
  ): Promise<ProjectListView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.updateProject(request);
    return result;
  }

  public async updateSettings(
    request: GlobalSettingsUpdateRequest,
  ): Promise<GlobalSettingsView> {
    await this.refreshPresenceIfDue();
    const result = await this.client.updateSettings(request);
    return result;
  }

  public async subscribeTimelineChanges(
    openSessionId: string,
    handler: (event: SessionTimelineChanged) => void,
  ): Promise<() => void> {
    await this.refreshPresenceIfDue();
    const result = await this.client.subscribeTimelineChanges(
      openSessionId,
      handler,
    );
    return result;
  }

  public async subscribeSessionIndexChanges(
    handler: (event: SessionsIndexChanged) => void,
  ): Promise<() => void> {
    await this.refreshPresenceIfDue();
    const result = await this.client.subscribeSessionIndexChanges(handler);
    return result;
  }

  private bumpConfigurationRevision(): number {
    this.configurationRevision += 1;
    return this.configurationRevision;
  }

  private resetPresence(): void {
    this.presence = null;
    this.lastPresenceUpdateMs = 0;
    this.presenceUpdateInFlight = null;
  }

  private async refreshPresence(): Promise<void> {
    if (this.presence === null) {
      return;
    }
    await this.client.updatePresence(this.presence);
    this.lastPresenceUpdateMs = Date.now();
  }

  private presenceRefreshDue(): boolean {
    if (this.presence === null) {
      return false;
    }
    return Date.now() - this.lastPresenceUpdateMs >= presenceRefreshIntervalMs;
  }

  private async refreshPresenceInFlight(): Promise<void> {
    this.presenceUpdateInFlight = this.refreshPresence();
    try {
      await this.presenceUpdateInFlight;
    } finally {
      this.presenceUpdateInFlight = null;
    }
  }

  private async refreshPresenceIfDue(): Promise<void> {
    if (!this.presenceRefreshDue()) {
      return;
    }
    if (this.presenceUpdateInFlight !== null) {
      await this.presenceUpdateInFlight;
      return;
    }
    await this.refreshPresenceInFlight();
  }
}

export { SessionClientManager };
