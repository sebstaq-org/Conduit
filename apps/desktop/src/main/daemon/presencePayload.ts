import type {
  DesktopPresenceClient,
  DesktopPresenceSnapshot,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function presenceDeviceKindValue(
  value: unknown,
): DesktopPresenceClient["deviceKind"] | null {
  if (value === "mobile" || value === "web") {
    return value;
  }
  return null;
}

function presenceTransportValue(
  value: unknown,
): DesktopPresenceClient["transport"] | null {
  if (value === "direct" || value === "relay") {
    return value;
  }
  return null;
}

function clientFields(value: Record<string, unknown>): {
  readonly clientId: string | null;
  readonly connected: boolean | null;
  readonly deviceKind: DesktopPresenceClient["deviceKind"] | null;
  readonly displayName: string | null;
  readonly lastSeenAt: string | null;
  readonly transport: DesktopPresenceClient["transport"] | null;
} {
  return {
    clientId: stringValue(value.clientId),
    connected: booleanValue(value.connected),
    deviceKind: presenceDeviceKindValue(value.deviceKind),
    displayName: stringValue(value.displayName),
    lastSeenAt: stringValue(value.lastSeenAt),
    transport: presenceTransportValue(value.transport),
  };
}

function completeClient(
  fields: ReturnType<typeof clientFields>,
): DesktopPresenceClient | null {
  if (
    fields.clientId === null ||
    fields.connected === null ||
    fields.deviceKind === null ||
    fields.displayName === null ||
    fields.lastSeenAt === null ||
    fields.transport === null
  ) {
    return null;
  }
  return {
    clientId: fields.clientId,
    connected: fields.connected,
    deviceKind: fields.deviceKind,
    displayName: fields.displayName,
    lastSeenAt: fields.lastSeenAt,
    transport: fields.transport,
  };
}

function readPresenceClient(value: unknown): DesktopPresenceClient | null {
  if (!isRecord(value)) {
    return null;
  }
  return completeClient(clientFields(value));
}

function readPresenceClients(value: unknown[]): DesktopPresenceClient[] | null {
  const clients: DesktopPresenceClient[] = [];
  for (const rawClient of value) {
    const client = readPresenceClient(rawClient);
    if (client === null) {
      return null;
    }
    clients.push(client);
  }
  return clients;
}

function readPresenceSnapshot(value: unknown): DesktopPresenceSnapshot | null {
  if (
    !isRecord(value) ||
    !isRecord(value.host) ||
    !Array.isArray(value.clients)
  ) {
    return null;
  }
  const hostDisplayName = stringValue(value.host.displayName);
  const hostServerId = stringValue(value.host.serverId);
  const clients = readPresenceClients(value.clients);
  if (hostDisplayName === null || hostServerId === null || clients === null) {
    return null;
  }
  return {
    clients,
    host: { displayName: hostDisplayName, serverId: hostServerId },
  };
}

export { readPresenceSnapshot };
