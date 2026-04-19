import { decodeBase64Bytes, decodeBase64UrlJson } from "./base64.js";
import type {
  AcceptConnectionOfferResult,
  ConnectionHostProfile,
  ConnectionOfferTrustResult,
  ConnectionOfferV1,
  TrustedHostRecord,
} from "./connection-offer-types.js";

const CONNECTION_OFFER_VERSION = 1 as const;
const CONNECTION_OFFER_VERSION_FIELD = "v" as const;
const OFFER_FRAGMENT_MARKER = "#offer=";
const AUTHORIZATION_BOUNDARY = "relay-handshake";
const OFFER_KEYS =
  "v serverId daemonPublicKeyB64 nonce expiresAt authorization relay".split(
    " ",
  );

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

function requireDaemonPublicKey(value: unknown): string {
  const publicKey = requireNonEmptyString(value, "daemonPublicKeyB64");
  if (publicKey.length % 4 !== 0) {
    throw new Error("pairing offer daemonPublicKeyB64 must be standard base64");
  }
  const bytes = decodeBase64Bytes(
    publicKey,
    "pairing offer daemonPublicKeyB64",
    false,
  );
  if (bytes.length !== 32) {
    throw new Error("pairing offer daemonPublicKeyB64 must decode to 32 bytes");
  }
  return publicKey;
}

function requireNonce(value: unknown): string {
  const nonce = requireNonEmptyString(value, "nonce");
  const bytes = decodeBase64Bytes(nonce, "pairing offer nonce", true);
  if (bytes.length !== 16) {
    throw new Error("pairing offer nonce must decode to 16 bytes");
  }
  return nonce;
}

function requireRelayServerId(value: unknown): string {
  const serverId = requireNonEmptyString(value, "relay.serverId");
  if (!serverId.startsWith("srv_")) {
    throw new Error("pairing offer relay.serverId is invalid");
  }
  return serverId;
}

function requireRelayCapability(value: unknown): string {
  const capability = requireNonEmptyString(value, "relay.clientCapability");
  const bytes = decodeBase64Bytes(
    capability,
    "pairing offer relay.clientCapability",
    true,
  );
  if (bytes.length !== 32) {
    throw new Error(
      "pairing offer relay.clientCapability must decode to 32 bytes",
    );
  }
  return capability;
}

function parseRelayEndpoint(endpoint: string): URL {
  try {
    return new URL(endpoint);
  } catch {
    throw new Error("pairing offer relay.endpoint must be an absolute URL");
  }
}

function requireRelayEndpoint(value: unknown): string {
  const endpoint = requireNonEmptyString(value, "relay.endpoint");
  const parsed = parseRelayEndpoint(endpoint);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("pairing offer relay.endpoint must use http or https");
  }
  return endpoint;
}

function requireExpiresAt(value: unknown, now: Date): string {
  const expiresAt = requireNonEmptyString(value, "expiresAt");
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    throw new TypeError("pairing offer expiresAt must be a valid timestamp");
  }
  if (expiresAtMs <= now.getTime()) {
    throw new Error("pairing offer has expired");
  }
  return expiresAt;
}

function requireAuthorization(
  value: unknown,
): ConnectionOfferV1["authorization"] {
  const authorization = requireRecord(value, "pairing offer authorization");
  assertExactKeys(
    authorization,
    ["required", "boundary"],
    "pairing offer authorization",
  );
  if (
    authorization.required !== true ||
    authorization.boundary !== AUTHORIZATION_BOUNDARY
  ) {
    throw new Error("pairing offer authorization boundary is invalid");
  }
  return { required: true, boundary: AUTHORIZATION_BOUNDARY };
}

function readConnectionOffer(
  value: unknown,
  now: Date = new Date(),
): ConnectionOfferV1 {
  const record = requireRecord(value, "pairing offer");
  assertExactKeys(record, OFFER_KEYS, "pairing offer");
  const relay = requireRecord(record.relay, "pairing offer relay");
  assertExactKeys(
    relay,
    ["endpoint", "serverId", "clientCapability"],
    "pairing offer relay",
  );
  if (record[CONNECTION_OFFER_VERSION_FIELD] !== CONNECTION_OFFER_VERSION) {
    throw new Error("unsupported pairing offer version");
  }
  const serverId = requireNonEmptyString(record.serverId, "serverId");
  if (!serverId.startsWith("srv_")) {
    throw new Error("pairing offer serverId is invalid");
  }
  return {
    [CONNECTION_OFFER_VERSION_FIELD]: CONNECTION_OFFER_VERSION,
    serverId,
    daemonPublicKeyB64: requireDaemonPublicKey(record.daemonPublicKeyB64),
    nonce: requireNonce(record.nonce),
    expiresAt: requireExpiresAt(record.expiresAt, now),
    authorization: requireAuthorization(record.authorization),
    relay: {
      endpoint: requireRelayEndpoint(relay.endpoint),
      serverId: requireRelayServerId(relay.serverId),
      clientCapability: requireRelayCapability(relay.clientCapability),
    },
  };
}

function parseConnectionOfferUrl(
  urlOrFragment: string,
  now?: Date,
): ConnectionOfferV1 {
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
  return readConnectionOffer(JSON.parse(decodeBase64UrlJson(encoded)), now);
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

function hostProfileFromOffer(
  offer: ConnectionOfferV1,
  now: Date = new Date(),
): ConnectionHostProfile {
  const timestamp = now.toISOString();
  return {
    createdAt: timestamp,
    lastSeenAt: timestamp,
    offerNonce: offer.nonce,
    relay: offer.relay,
    revokedAt: null,
    serverId: offer.serverId,
    trustedDaemonPublicKeyB64: offer.daemonPublicKeyB64,
  };
}

function relayOfferFromHostProfile(
  host: ConnectionHostProfile,
): ConnectionOfferV1 {
  return {
    [CONNECTION_OFFER_VERSION_FIELD]: CONNECTION_OFFER_VERSION,
    authorization: { boundary: AUTHORIZATION_BOUNDARY, required: true },
    daemonPublicKeyB64: host.trustedDaemonPublicKeyB64,
    expiresAt: new Date(8_640_000_000_000_000).toISOString(),
    nonce: host.offerNonce,
    relay: host.relay,
    serverId: host.serverId,
  };
}

function acceptConnectionOffer(
  offer: ConnectionOfferV1,
  hosts: readonly ConnectionHostProfile[],
  now: Date = new Date(),
): AcceptConnectionOfferResult {
  const trust = evaluateConnectionOfferTrust(offer, hosts);
  if (trust.kind === "key_changed") {
    return { kind: "blocked_key_changed", offer, host: trust.host };
  }
  if (trust.kind === "revoked_host") {
    return { kind: "blocked_revoked", offer, host: trust.host };
  }
  return {
    host: hostProfileFromOffer(offer, now),
    kind: "accepted",
    trust: trust.kind,
  };
}

function publicKeyFingerprint(publicKeyB64: string): string {
  return publicKeyB64.replaceAll(/[^A-Za-z0-9]/gu, "").slice(0, 12);
}

export {
  AUTHORIZATION_BOUNDARY,
  CONNECTION_OFFER_VERSION,
  acceptConnectionOffer,
  evaluateConnectionOfferTrust,
  hostProfileFromOffer,
  parseConnectionOfferUrl,
  publicKeyFingerprint,
  readConnectionOffer,
  relayOfferFromHostProfile,
};

export type {
  AcceptConnectionOfferResult,
  ConnectionHostProfile,
  ConnectionOfferTrustResult,
  ConnectionOfferV1,
  TrustedHostRecord,
} from "./connection-offer-types.js";
