const RELAY_PROTOCOL_VERSION = 1;
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
    readonly serverId: string;
    readonly role: RelayRole;
    readonly connectionId?: string;
  },
): string {
  const url = new URL(endpoint);
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else {
    url.protocol = "wss:";
  }
  url.pathname = `/v1/relay/${encodeURIComponent(options.serverId)}`;
  url.searchParams.set("role", options.role);
  if (options.connectionId !== undefined) {
    url.searchParams.set("connectionId", options.connectionId);
  }
  return url.toString();
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

export { RELAY_PROTOCOL_VERSION, buildRelayWebSocketUrl, parseRelayEnvelope };
export type { RelayControlFrame, RelayEnvelope, RelayRole };
