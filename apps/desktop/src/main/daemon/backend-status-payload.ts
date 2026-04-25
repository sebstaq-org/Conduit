import { readPresenceSnapshot } from "./presencePayload.js";
import type { DesktopPresenceSnapshot } from "./types.js";

interface DaemonStatusPayload {
  readonly mobilePeerConnected: boolean;
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

function readDaemonStatusPayload(value: unknown): DaemonStatusPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const pairingConfigured = booleanValue(value.pairingConfigured);
  const mobilePeerConnected = booleanValue(value.mobilePeerConnected);
  const presence = readPresenceSnapshot(value.presence);
  const relayEndpoint = optionalStringValue(value.relayEndpoint);
  const serverId = stringValue(value.serverId);
  if (
    mobilePeerConnected === null ||
    pairingConfigured === null ||
    presence === null ||
    relayEndpoint === undefined ||
    serverId === null
  ) {
    return null;
  }
  return {
    mobilePeerConnected,
    pairingConfigured,
    presence,
    relayEndpoint,
    serverId,
  };
}

export { readDaemonStatusPayload };
export type { DaemonStatusPayload };
