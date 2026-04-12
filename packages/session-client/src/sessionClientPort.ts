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
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
  promptSession(request: SessionPromptRequest): Promise<void>;
  subscribeTimelineChanges(
    openSessionId: string,
    handler: (event: SessionTimelineChanged) => void,
  ): Promise<() => void>;
  subscribeSessionIndexChanges(
    handler: (event: SessionsIndexChanged) => void,
  ): Promise<() => void>;
}

interface SessionClientOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
}

export type { SessionClientOptions, SessionClientPort };
