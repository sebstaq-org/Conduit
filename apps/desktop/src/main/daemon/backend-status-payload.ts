import { readPresenceSnapshot } from "./presencePayload.js";
import type {
  DesktopMobileConnection,
  DesktopPresenceSnapshot,
} from "./types.js";

interface DaemonStatusPayload {
  readonly mobileConnection: DesktopMobileConnection;
  readonly pairingConfigured: boolean;
  readonly presence: DesktopPresenceSnapshot;
  readonly relayEndpoint: string | null;
  readonly serverId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function optionalStringValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function readMobileConnection(value: unknown): DesktopMobileConnection | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = stringValue(value.status);
  const connectionId = optionalStringValue(value.connectionId);
  const generation =
    value.generation === null ? null : numberValue(value.generation);
  const lastError = optionalStringValue(value.lastError);
  const staleAt = optionalStringValue(value.staleAt);
  const transport = stringValue(value.transport);
  const verifiedAt = optionalStringValue(value.verifiedAt);
  if (
    !(
      status === "idle" ||
      status === "waiting" ||
      status === "connected" ||
      status === "reconnecting" ||
      status === "disconnected"
    ) ||
    connectionId === undefined ||
    (generation === null && value.generation !== null) ||
    lastError === undefined ||
    staleAt === undefined ||
    transport !== "relay" ||
    verifiedAt === undefined
  ) {
    return null;
  }
  return {
    connectionId,
    generation,
    lastError,
    staleAt,
    status,
    transport,
    verifiedAt,
  };
}

function readDaemonStatusPayload(value: unknown): DaemonStatusPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const pairingConfigured = booleanValue(value.pairingConfigured);
  const mobileConnection = readMobileConnection(value.mobileConnection);
  const presence = readPresenceSnapshot(value.presence);
  const relayEndpoint = optionalStringValue(value.relayEndpoint);
  const serverId = stringValue(value.serverId);
  if (
    mobileConnection === null ||
    pairingConfigured === null ||
    presence === null ||
    relayEndpoint === undefined ||
    serverId === null
  ) {
    return null;
  }
  return {
    mobileConnection,
    pairingConfigured,
    presence,
    relayEndpoint,
    serverId,
  };
}

export { readDaemonStatusPayload };
export type { DaemonStatusPayload };
