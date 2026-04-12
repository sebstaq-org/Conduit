export {
  WebSocketSessionClient,
  createSessionClient,
} from "./webSocketSessionClient.js";
export { PROVIDERS } from "@conduit/session-model";

export type {
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectRow,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-contracts";
export type {
  ContentBlock,
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
  TranscriptEventItem,
  TranscriptItem,
} from "@conduit/session-model";
export type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";
export type {
  SessionClientOptions,
  SessionClientPort,
} from "./sessionClientPort.js";
