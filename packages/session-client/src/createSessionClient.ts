import { WebSocketSessionClient } from "./webSocketSessionClient.js";
import type {
  SessionClientOptions,
  SessionClientPort,
} from "./sessionClientPort.js";

const createSessionClient = (
  options?: SessionClientOptions,
): SessionClientPort => new WebSocketSessionClient(options);

export { createSessionClient };
