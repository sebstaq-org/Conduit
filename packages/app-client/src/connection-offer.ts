const CONNECTION_OFFER_VERSION = 1 as const;
const OFFER_FRAGMENT_MARKER = "#offer=";

interface ConnectionOfferV1 {
  v: typeof CONNECTION_OFFER_VERSION;
  serverId: string;
  daemonPublicKeyB64: string;
  relay: {
    endpoint: string;
  };
}

interface TrustedHostRecord {
  serverId: string;
  trustedDaemonPublicKeyB64: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
}

type ConnectionOfferTrustResult =
  | { kind: "new_host"; offer: ConnectionOfferV1 }
  | { kind: "known_host"; offer: ConnectionOfferV1; host: TrustedHostRecord }
  | { kind: "key_changed"; offer: ConnectionOfferV1; host: TrustedHostRecord }
  | { kind: "revoked_host"; offer: ConnectionOfferV1; host: TrustedHostRecord };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unsupported field ${key}`);
    }
  }
  for (const key of keys) {
    if (!(key in value)) {
      throw new Error(`${label} is missing ${key}`);
    }
  }
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`pairing offer ${field} must be a non-empty string`);
  }
  return value.trim();
}

function decodeBase64UrlUtf8(encoded: string): string {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeStandardBase64Bytes(encoded: string): Uint8Array {
  if (!/^[+/0-9=A-Za-z]+$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error("pairing offer daemonPublicKeyB64 must be standard base64");
  }
  if (typeof atob === "function") {
    const binary = atob(encoded);
    return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
  }
  return Uint8Array.from(Buffer.from(encoded, "base64"));
}

function requireDaemonPublicKey(value: unknown): string {
  const publicKey = requireNonEmptyString(value, "daemonPublicKeyB64");
  const bytes = decodeStandardBase64Bytes(publicKey);
  if (bytes.length !== 32) {
    throw new Error("pairing offer daemonPublicKeyB64 must decode to 32 bytes");
  }
  return publicKey;
}

function readConnectionOffer(value: unknown): ConnectionOfferV1 {
  const record = requireRecord(value, "pairing offer");
  assertExactKeys(
    record,
    ["v", "serverId", "daemonPublicKeyB64", "relay"],
    "pairing offer",
  );
  const relay = requireRecord(record.relay, "pairing offer relay");
  assertExactKeys(relay, ["endpoint"], "pairing offer relay");
  if (record.v !== CONNECTION_OFFER_VERSION) {
    throw new Error("unsupported pairing offer version");
  }
  const serverId = requireNonEmptyString(record.serverId, "serverId");
  if (!serverId.startsWith("srv_")) {
    throw new Error("pairing offer serverId is invalid");
  }
  return {
    v: CONNECTION_OFFER_VERSION,
    serverId,
    daemonPublicKeyB64: requireDaemonPublicKey(record.daemonPublicKeyB64),
    relay: {
      endpoint: requireNonEmptyString(relay.endpoint, "relay.endpoint"),
    },
  };
}

function parseConnectionOfferUrl(urlOrFragment: string): ConnectionOfferV1 {
  const markerIndex = urlOrFragment.indexOf(OFFER_FRAGMENT_MARKER);
  if (markerIndex === -1) {
    throw new Error("pairing offer URL is missing #offer= fragment");
  }
  const encoded = urlOrFragment
    .slice(markerIndex + OFFER_FRAGMENT_MARKER.length)
    .trim();
  if (!encoded) {
    throw new Error("pairing offer fragment is empty");
  }
  return readConnectionOffer(JSON.parse(decodeBase64UrlUtf8(encoded)));
}

function evaluateConnectionOfferTrust(
  offer: ConnectionOfferV1,
  hosts: readonly TrustedHostRecord[],
): ConnectionOfferTrustResult {
  const host = hosts.find((candidate) => candidate.serverId === offer.serverId);
  if (!host) {
    return { kind: "new_host", offer };
  }
  if (host.revokedAt !== null) {
    return { kind: "revoked_host", offer, host };
  }
  if (host.trustedDaemonPublicKeyB64 !== offer.daemonPublicKeyB64) {
    return { kind: "key_changed", offer, host };
  }
  return { kind: "known_host", offer, host };
}

export {
  CONNECTION_OFFER_VERSION,
  evaluateConnectionOfferTrust,
  parseConnectionOfferUrl,
  readConnectionOffer,
};

export type {
  ConnectionOfferTrustResult,
  ConnectionOfferV1,
  TrustedHostRecord,
};
