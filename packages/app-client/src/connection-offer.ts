const CONNECTION_OFFER_VERSION = 1 as const;
const CONNECTION_OFFER_VERSION_FIELD = "v" as const;
const OFFER_FRAGMENT_MARKER = "#offer=";
const AUTHORIZATION_BOUNDARY = "relay-handshake";
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_PATTERN =
  /^(?:[+/0-9A-Za-z]{4})*(?:[+/0-9A-Za-z]{2}==|[+/0-9A-Za-z]{3}=)?$/;
const OFFER_KEYS =
  "v serverId daemonPublicKeyB64 nonce expiresAt authorization relay".split(
    " ",
  );

type ConnectionOfferV1 = Record<
  typeof CONNECTION_OFFER_VERSION_FIELD,
  typeof CONNECTION_OFFER_VERSION
> & {
  serverId: string;
  daemonPublicKeyB64: string;
  nonce: string;
  expiresAt: string;
  authorization: {
    required: true;
    boundary: typeof AUTHORIZATION_BOUNDARY;
  };
  relay: {
    endpoint: string;
  };
};

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

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) {
    throw new Error("pairing offer fragment must be valid bytes");
  }
  return value;
}

function sextet(character: string): number {
  const value = BASE64_ALPHABET.indexOf(character);
  if (value === -1) {
    throw new Error("pairing offer contains invalid base64");
  }
  return value;
}

function normalizedBase64(
  encoded: string,
  label: string,
  urlSafe: boolean,
): string {
  let normalized = encoded;
  if (urlSafe) {
    normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  }
  if (normalized.length % 4 === 1) {
    throw new Error(`${label} must be valid base64`);
  }
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  if (!BASE64_PATTERN.test(padded)) {
    throw new Error(`${label} must be valid base64`);
  }
  return padded;
}

function optionalSextet(character: string): number {
  if (character === "=") {
    return 0;
  }
  return sextet(character);
}

function decodePaddedBase64Chunk(chunk: string, bytes: number[]): void {
  const first = sextet(chunk.charAt(0));
  const second = sextet(chunk.charAt(1));
  const third = optionalSextet(chunk.charAt(2));
  const fourth = optionalSextet(chunk.charAt(3));
  bytes.push(first * 4 + Math.floor(second / 16));
  if (chunk.charAt(2) !== "=") {
    bytes.push((second % 16) * 16 + Math.floor(third / 4));
  }
  if (chunk.charAt(3) !== "=") {
    bytes.push((third % 4) * 64 + fourth);
  }
}

function decodeBase64Bytes(
  encoded: string,
  label: string,
  urlSafe: boolean,
): Uint8Array {
  const padded = normalizedBase64(encoded, label, urlSafe);
  const bytes: number[] = [];
  for (let index = 0; index < padded.length; index += 4) {
    decodePaddedBase64Chunk(padded.slice(index, index + 4), bytes);
  }
  return Uint8Array.from(bytes);
}

function decodeAscii(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 1) {
    const value = byteAt(bytes, index);
    if (value > 127) {
      throw new Error("pairing offer fragment must be ASCII JSON");
    }
    result += String.fromCodePoint(value);
  }
  return result;
}

function decodeBase64UrlJson(encoded: string): string {
  return decodeAscii(
    decodeBase64Bytes(encoded, "pairing offer fragment", true),
  );
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
  assertExactKeys(relay, ["endpoint"], "pairing offer relay");
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
      endpoint: requireNonEmptyString(relay.endpoint, "relay.endpoint"),
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

export {
  AUTHORIZATION_BOUNDARY,
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
