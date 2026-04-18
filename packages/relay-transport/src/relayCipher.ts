import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { decodeStandardBase64, encodeStandardBase64 } from "./base64.js";

const RELAY_CIPHER_VERSION = 1;
const cipherVersionField = "v";
const keyLength = 32;
const sharedMaterialLength = 64;
const nonceLength = 12;
const sequenceModulus = 256;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type RelayPeerRole = "client" | "server";

interface RelayHandshakeFrame {
  readonly v: typeof RELAY_CIPHER_VERSION;
  readonly type: "handshake";
  readonly clientPublicKeyB64: string;
}

interface RelayCipherFrame {
  readonly v: typeof RELAY_CIPHER_VERSION;
  readonly type: "ciphertext";
  readonly sender: RelayPeerRole;
  readonly seq: number;
  readonly ciphertextB64: string;
}

interface RelayCipherContext {
  readonly serverId: string;
  readonly connectionId: string;
  readonly offerNonce: string;
}

interface RelayDaemonKeyPair {
  readonly secretKeyB64: string;
  readonly publicKeyB64: string;
}

class RelayCipherChannel {
  private readonly context: RelayCipherContext;
  private readonly decryptKey: CryptoKey;
  private readonly encryptKey: CryptoKey;
  private readonly localRole: RelayPeerRole;
  private nextInboundSequence = 0;
  private nextOutboundSequence = 0;

  private constructor(options: {
    readonly context: RelayCipherContext;
    readonly decryptKey: CryptoKey;
    readonly encryptKey: CryptoKey;
    readonly localRole: RelayPeerRole;
  }) {
    this.context = options.context;
    this.decryptKey = options.decryptKey;
    this.encryptKey = options.encryptKey;
    this.localRole = options.localRole;
  }

  public static async create(options: {
    readonly context: RelayCipherContext;
    readonly localRole: RelayPeerRole;
    readonly sharedSecret: Uint8Array;
  }): Promise<RelayCipherChannel> {
    const keys = await importCipherKeys(options.sharedSecret, options.context);
    return new RelayCipherChannel({
      context: options.context,
      decryptKey:
        options.localRole === "client"
          ? keys.serverToClient
          : keys.clientToServer,
      encryptKey:
        options.localRole === "client"
          ? keys.clientToServer
          : keys.serverToClient,
      localRole: options.localRole,
    });
  }

  public async encryptUtf8(plaintext: string): Promise<RelayCipherFrame> {
    const sequence = this.nextOutboundSequence;
    this.nextOutboundSequence += 1;
    const ciphertext = await crypto.subtle.encrypt(
      {
        additionalData: additionalData(this.context, this.localRole, sequence),
        iv: nonceFor(this.localRole, sequence),
        name: "AES-GCM",
      },
      this.encryptKey,
      bytesForCrypto(textEncoder.encode(plaintext)),
    );
    return {
      v: RELAY_CIPHER_VERSION,
      type: "ciphertext",
      sender: this.localRole,
      seq: sequence,
      ciphertextB64: encodeStandardBase64(new Uint8Array(ciphertext)),
    };
  }

  public async decryptUtf8(frame: RelayCipherFrame): Promise<string> {
    validateCipherFrame(frame);
    if (frame.sender === this.localRole) {
      throw new Error("relay cipher frame came from local peer");
    }
    if (frame.seq !== this.nextInboundSequence) {
      throw new Error("relay cipher frame sequence is invalid");
    }
    const ciphertext = decodeStandardBase64(frame.ciphertextB64);
    const plaintext = await crypto.subtle.decrypt(
      {
        additionalData: additionalData(this.context, frame.sender, frame.seq),
        iv: nonceFor(frame.sender, frame.seq),
        name: "AES-GCM",
      },
      this.decryptKey,
      bytesForCrypto(ciphertext),
    );
    this.nextInboundSequence += 1;
    return textDecoder.decode(plaintext);
  }
}

async function createRelayClientHandshake(options: {
  readonly context: RelayCipherContext;
  readonly daemonPublicKeyB64: string;
}): Promise<{
  readonly channel: RelayCipherChannel;
  readonly handshake: RelayHandshakeFrame;
}> {
  const clientSecretKey = randomBytes(keyLength);
  const clientPublicKey = x25519.getPublicKey(clientSecretKey);
  const daemonPublicKey = decodeStandardBase64(options.daemonPublicKeyB64);
  const sharedSecret = x25519.getSharedSecret(clientSecretKey, daemonPublicKey);
  const channel = await RelayCipherChannel.create({
    context: options.context,
    localRole: "client",
    sharedSecret,
  });
  return {
    channel,
    handshake: {
      v: RELAY_CIPHER_VERSION,
      type: "handshake",
      clientPublicKeyB64: encodeStandardBase64(clientPublicKey),
    },
  };
}

async function acceptRelayClientHandshake(options: {
  readonly context: RelayCipherContext;
  readonly daemonSecretKeyB64: string;
  readonly handshake: RelayHandshakeFrame;
}): Promise<RelayCipherChannel> {
  validateHandshakeFrame(options.handshake);
  const daemonSecretKey = decodeStandardBase64(options.daemonSecretKeyB64);
  const clientPublicKey = decodeStandardBase64(
    options.handshake.clientPublicKeyB64,
  );
  const sharedSecret = x25519.getSharedSecret(daemonSecretKey, clientPublicKey);
  return RelayCipherChannel.create({
    context: options.context,
    localRole: "server",
    sharedSecret,
  });
}

function generateRelayDaemonKeyPair(): RelayDaemonKeyPair {
  const secretKey = randomBytes(keyLength);
  const publicKey = x25519.getPublicKey(secretKey);
  return {
    publicKeyB64: encodeStandardBase64(publicKey),
    secretKeyB64: encodeStandardBase64(secretKey),
  };
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function importCipherKeys(
  sharedSecret: Uint8Array,
  context: RelayCipherContext,
): Promise<{
  readonly clientToServer: CryptoKey;
  readonly serverToClient: CryptoKey;
}> {
  const material = hkdf(
    sha256,
    sharedSecret,
    textEncoder.encode(
      `conduit-relay:${context.serverId}:${context.connectionId}:${context.offerNonce}`,
    ),
    textEncoder.encode("conduit relay e2ee v1"),
    sharedMaterialLength,
  );
  const clientToServer = material.slice(0, keyLength);
  const serverToClient = material.slice(keyLength, sharedMaterialLength);
  return {
    clientToServer: await importAesKey(clientToServer),
    serverToClient: await importAesKey(serverToClient),
  };
}

async function importAesKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bytesForCrypto(key),
    { name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"],
  );
}

function nonceFor(
  sender: RelayPeerRole,
  sequence: number,
): Uint8Array<ArrayBuffer> {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("relay cipher frame sequence is invalid");
  }
  const nonce = new Uint8Array(nonceLength);
  nonce[0] = sender === "client" ? 1 : 2;
  let remaining = sequence;
  for (let offset = nonceLength - 1; offset >= 4; offset -= 1) {
    nonce[offset] = remaining % sequenceModulus;
    remaining = Math.floor(remaining / sequenceModulus);
  }
  return nonce;
}

function additionalData(
  context: RelayCipherContext,
  sender: RelayPeerRole,
  sequence: number,
): Uint8Array<ArrayBuffer> {
  return bytesForCrypto(
    textEncoder.encode(
      `conduit-relay-frame:${context.serverId}:${context.connectionId}:${context.offerNonce}:${sender}:${sequence}`,
    ),
  );
}

function bytesForCrypto(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function validateHandshakeFrame(frame: RelayHandshakeFrame): void {
  if (
    frame[cipherVersionField] !== RELAY_CIPHER_VERSION ||
    frame.type !== "handshake"
  ) {
    throw new Error("relay handshake frame is invalid");
  }
  if (decodeStandardBase64(frame.clientPublicKeyB64).byteLength !== keyLength) {
    throw new Error("relay handshake public key is invalid");
  }
}

function validateCipherFrame(frame: RelayCipherFrame): void {
  if (
    frame[cipherVersionField] !== RELAY_CIPHER_VERSION ||
    frame.type !== "ciphertext"
  ) {
    throw new Error("relay cipher frame is invalid");
  }
  if (frame.sender !== "client" && frame.sender !== "server") {
    throw new Error("relay cipher frame sender is invalid");
  }
}

export {
  RelayCipherChannel,
  acceptRelayClientHandshake,
  createRelayClientHandshake,
  generateRelayDaemonKeyPair,
};
export type {
  RelayCipherContext,
  RelayCipherFrame,
  RelayHandshakeFrame,
  RelayPeerRole,
};
