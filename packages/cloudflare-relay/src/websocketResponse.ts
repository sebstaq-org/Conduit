import {
  buildRelayWebSocketProtocol,
  parseRelayWebSocketProtocol,
} from "@conduit/relay-transport";

import type { WebSocketResponseInit, WorkerWebSocket } from "./workerTypes.js";

function relayProtocolForResponse(request: Request): string {
  const capability = parseRelayWebSocketProtocol(
    request.headers.get("Sec-WebSocket-Protocol"),
  );
  return buildRelayWebSocketProtocol(capability);
}

function websocketResponse(
  webSocket: WorkerWebSocket,
  protocol: string,
): Response {
  const init: WebSocketResponseInit = {
    headers: { "Sec-WebSocket-Protocol": protocol },
    status: 101,
    webSocket,
  };
  return new Response(null, init);
}

export { relayProtocolForResponse, websocketResponse };
