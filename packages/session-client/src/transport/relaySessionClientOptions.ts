import type { SessionClientTelemetryEvent } from "./sessionClientTelemetryEvent.js";

interface RelayConnectionOffer {
  readonly daemonPublicKeyB64: string;
  readonly nonce: string;
  readonly relay: {
    readonly endpoint: string;
    readonly serverId: string;
    readonly clientCapability: string;
  };
}

type RelayWebSocket = Pick<
  WebSocket,
  "addEventListener" | "close" | "readyState" | "send"
>;

type RelayWebSocketConstructor = new (
  url: string | URL,
  protocols?: string | string[],
) => RelayWebSocket;

interface RelaySessionClientOptions {
  readonly offer: RelayConnectionOffer;
  readonly WebSocketImpl?: RelayWebSocketConstructor;
  readonly onTelemetryEvent?: (event: SessionClientTelemetryEvent) => void;
}

export type {
  RelayConnectionOffer,
  RelaySessionClientOptions,
  RelayWebSocket,
  RelayWebSocketConstructor,
};
