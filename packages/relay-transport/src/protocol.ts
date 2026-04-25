import { sha256 } from "@noble/hashes/sha2.js";

import { encodeUrlBase64 } from "./base64.js";

const RELAY_CAPABILITY_BYTES = 32;
const RELAY_CAPABILITY_ENCODED_LENGTH = 43;
const RELAY_PROTOCOL_VERSION = 1;
const RELAY_WEBSOCKET_PROTOCOL_PREFIX = "conduit-relay.v1.";
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const relayVersionField = "v";

type RelayRole = "client" | "server";

interface RelayControlFrame {
  readonly v: typeof RELAY_PROTOCOL_VERSION;
  readonly type: "client_waiting" | "data_closed" | "client_closed";
  readonly connectionId: string;
}

type RelayEnvelope = RelayControlFrame;

function buildRelayWebSocketUrl(
  endpoint: string,
  options: {
    readonly capability: string;
    readonly serverId: string;
    readonly role: RelayRole;
    readonly connectionId?: string;
  },
): string {
  assertRelayCapability(options.capability);
  const url = new URL(endpoint);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else {
    throw new Error("relay endpoint must use http or https");
  }
  url.pathname = `/v1/relay/${encodeURIComponent(options.serverId)}`;
  url.searchParams.set("role", options.role);
  if (options.connectionId !== undefined) {
    url.searchParams.set("connectionId", options.connectionId);
  }
  return url.toString();
}

function buildRelayWebSocketProtocol(capability: string): string {
  assertRelayCapability(capability);
  return `${RELAY_WEBSOCKET_PROTOCOL_PREFIX}${capability}`;
}

function deriveRelayConnectionId(clientCapability: string): string {
  assertRelayCapability(clientCapability);
  return `conn_${digestRouteId("client", clientCapability)}`;
}

function deriveRelayServerId(daemonCapability: string): string {
  assertRelayCapability(daemonCapability);
  return `srv_${digestRouteId("server", daemonCapability)}`;
}

function generateRelayCapability(): string {
  const bytes = new Uint8Array(RELAY_CAPABILITY_BYTES);
  crypto.getRandomValues(bytes);
  return encodeUrlBase64(bytes);
}

function parseRelayWebSocketProtocol(header: string | null): string {
  if (header === null) {
    throw new Error("relay websocket protocol is required");
  }
  for (const rawProtocol of header.split(",")) {
    const protocol = rawProtocol.trim();
    if (protocol.startsWith(RELAY_WEBSOCKET_PROTOCOL_PREFIX)) {
      const capability = protocol.slice(RELAY_WEBSOCKET_PROTOCOL_PREFIX.length);
      assertRelayCapability(capability);
      return capability;
    }
  }
  throw new Error("relay websocket protocol is invalid");
}

function parseRelayEnvelope(value: string): RelayEnvelope {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("relay envelope must be an object");
  }
  return relayEnvelopeFromRecord(parsed);
}

function relayEnvelopeFromRecord(record: object): RelayEnvelope {
  const version = recordField(record, relayVersionField);
  if (version !== RELAY_PROTOCOL_VERSION) {
    throw new Error("unsupported relay envelope version");
  }
  const type = recordField(record, "type");
  if (
    type !== "client_waiting" &&
    type !== "data_closed" &&
    type !== "client_closed"
  ) {
    throw new Error("unsupported relay envelope type");
  }
  const connectionId = recordField(record, "connectionId");
  if (typeof connectionId !== "string" || connectionId.length === 0) {
    throw new Error("relay envelope connectionId is invalid");
  }
  return {
    v: RELAY_PROTOCOL_VERSION,
    type,
    connectionId,
  };
}

function recordField(record: object, field: string): unknown {
  return (record as Record<string, unknown>)[field];
}

function assertRelayCapability(value: string): void {
  if (
    value.length !== RELAY_CAPABILITY_ENCODED_LENGTH ||
    !capabilityPattern.test(value)
  ) {
    throw new Error("relay capability is invalid");
  }
}

function digestRouteId(kind: "client" | "server", capability: string): string {
  const bytes = new TextEncoder().encode(
    `conduit-relay-route:${kind}:${capability}`,
  );
  return encodeUrlBase64(sha256(bytes));
}

export {
  RELAY_PROTOCOL_VERSION,
  buildRelayWebSocketProtocol,
  buildRelayWebSocketUrl,
  deriveRelayConnectionId,
  deriveRelayServerId,
  generateRelayCapability,
  parseRelayEnvelope,
  parseRelayWebSocketProtocol,
};
export type { RelayControlFrame, RelayEnvelope, RelayRole };
