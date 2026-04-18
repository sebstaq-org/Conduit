import { describe, expect, it } from "vitest";

import {
  acceptRelayClientHandshake,
  createRelayClientHandshake,
  generateRelayDaemonKeyPair,
} from "./relayCipher.js";
import type { RelayCipherFrame } from "./relayCipher.js";

const context = {
  connectionId: "connection-1",
  offerNonce: "EjRWeBI0VngSNFZ4EjRWeA",
  serverId: "srv_test",
};

describe("relay cipher channel", () => {
  it("encrypts and decrypts frames in both directions", async () => {
    const daemon = generateRelayDaemonKeyPair();
    const client = await createRelayClientHandshake({
      context,
      daemonPublicKeyB64: daemon.publicKeyB64,
    });
    const server = await acceptRelayClientHandshake({
      context,
      daemonSecretKeyB64: daemon.secretKeyB64,
      handshake: client.handshake,
    });

    const clientFrame = await client.channel.encryptUtf8(
      "plaintext marker from client",
    );
    const serverFrame = await server.encryptUtf8(
      "plaintext marker from server",
    );

    expect(JSON.stringify(clientFrame)).not.toContain("plaintext marker");
    expect(JSON.stringify(serverFrame)).not.toContain("plaintext marker");
    await expect(server.decryptUtf8(clientFrame)).resolves.toBe(
      "plaintext marker from client",
    );
    await expect(client.channel.decryptUtf8(serverFrame)).resolves.toBe(
      "plaintext marker from server",
    );
  });

  it("rejects replayed ciphertext sequence numbers", async () => {
    const daemon = generateRelayDaemonKeyPair();
    const client = await createRelayClientHandshake({
      context,
      daemonPublicKeyB64: daemon.publicKeyB64,
    });
    const server = await acceptRelayClientHandshake({
      context,
      daemonSecretKeyB64: daemon.secretKeyB64,
      handshake: client.handshake,
    });
    const frame = await client.channel.encryptUtf8("one-shot payload");

    await expect(server.decryptUtf8(frame)).resolves.toBe("one-shot payload");
    await expect(server.decryptUtf8(frame)).rejects.toThrow(
      "relay cipher frame sequence is invalid",
    );
  });

  it("rejects tampered ciphertext", async () => {
    const daemon = generateRelayDaemonKeyPair();
    const client = await createRelayClientHandshake({
      context,
      daemonPublicKeyB64: daemon.publicKeyB64,
    });
    const server = await acceptRelayClientHandshake({
      context,
      daemonSecretKeyB64: daemon.secretKeyB64,
      handshake: client.handshake,
    });
    const frame = await client.channel.encryptUtf8("untampered payload");
    const tampered: RelayCipherFrame = {
      ...frame,
      ciphertextB64: `${frame.ciphertextB64.slice(0, -2)}AA`,
    };

    await expect(server.decryptUtf8(tampered)).rejects.toThrow();
  });
});
