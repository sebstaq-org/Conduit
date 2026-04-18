import { RelayWebSocketTransport } from "./transport/relayWebSocketTransport.js";
import { WebSocketSessionClient } from "./webSocketSessionClient.js";
import type { RelaySessionClientOptions } from "./transport/relayWebSocketTransport.js";
import type { SessionClientPort } from "./sessionClientPort.js";

const createRelaySessionClient = (
  options: RelaySessionClientOptions,
): SessionClientPort => {
  let client: WebSocketSessionClient | null = null;
  const transport = new RelayWebSocketTransport(options, (event) => {
    client?.handleRuntimeEvent(event);
  });
  client = new WebSocketSessionClient(options, transport);
  return client;
};

export { createRelaySessionClient };
export type { RelaySessionClientOptions };
