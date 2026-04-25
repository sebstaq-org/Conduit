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

interface RelaySessionClientOptions {
  readonly offer: RelayConnectionOffer;
  readonly WebSocketImpl?: typeof WebSocket;
  readonly onTelemetryEvent?: (event: SessionClientTelemetryEvent) => void;
}

export type { RelayConnectionOffer, RelaySessionClientOptions };
