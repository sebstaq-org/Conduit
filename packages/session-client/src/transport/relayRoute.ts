import {
  buildRelayWebSocketProtocol,
  buildRelayWebSocketUrl,
  deriveRelayConnectionId,
} from "@conduit/relay-transport";
import type { RelayConnectionOffer } from "./relayWebSocketTransport.js";

interface RelaySocketRoute {
  readonly connectionId: string;
  readonly protocol: string;
  readonly url: string;
}

function relaySocketRoute(offer: RelayConnectionOffer): RelaySocketRoute {
  const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
  return {
    connectionId,
    protocol: buildRelayWebSocketProtocol(offer.relay.clientCapability),
    url: buildRelayWebSocketUrl(offer.relay.endpoint, {
      capability: offer.relay.clientCapability,
      connectionId,
      role: "client",
      serverId: offer.relay.serverId,
    }),
  };
}

export { relaySocketRoute };
export type { RelaySocketRoute };
