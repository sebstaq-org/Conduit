import type {
  ConsumerResponse,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-contracts";
import type {
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
} from "@conduit/session-model";
import type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";

interface SessionClientPort {
  readonly policy: "official-acp-only";
  getSessionGroups(query?: SessionGroupsQuery): Promise<SessionGroupsView>;
  openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
  readSessionHistory(
    provider: ProviderId,
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
  promptSession(
    provider: ProviderId,
    request: SessionPromptRequest,
  ): Promise<void>;
  subscribeTimelineChanges(
    provider: ProviderId,
    handler: (event: SessionTimelineChanged) => void,
    afterSequence?: number | null,
  ): Promise<() => void>;
  subscribeSessionIndexChanges(
    provider: ProviderId,
    handler: (event: SessionsIndexChanged) => void,
    afterSequence?: number | null,
  ): Promise<() => void>;
}

interface SessionClientOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
}

export type { SessionClientOptions, SessionClientPort };
