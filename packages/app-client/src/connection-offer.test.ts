import { describe, expect, it, vi } from "vitest";
import {
  AUTHORIZATION_BOUNDARY,
  evaluateConnectionOfferTrust,
  parseConnectionOfferUrl,
  readConnectionOffer,
} from "./index.js";
import type { ConnectionOfferV1, TrustedHostRecord } from "./index.js";

const daemonPublicKeyB64 = "g7EHNunwYfhVBZWTysT7l3F7knCHXeAFYk4/Oo4ff3Q=";
const validNow = new Date("2026-04-18T00:00:00.000Z");
const validOfferJson = `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","nonce":"EjRWeBI0VngSNFZ4EjRWeA","expiresAt":"2026-04-18T00:10:00Z","authorization":{"required":true,"boundary":"${AUTHORIZATION_BOUNDARY}"},"relay":{"endpoint":"relay.example.test:443"}}`;
const offer = readConnectionOffer(JSON.parse(validOfferJson), validNow);

function trustedHost(publicKey: string): TrustedHostRecord {
  return {
    serverId: offer.serverId,
    trustedDaemonPublicKeyB64: publicKey,
    revokedAt: null,
    lastSeenAt: null,
  };
}

function encodeOffer(value: ConnectionOfferV1): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("connection offer parser", () => {
  it("decodes a #offer fragment", () => {
    expect(
      parseConnectionOfferUrl(
        `https://app.test/#offer=${encodeOffer(offer)}`,
        validNow,
      ),
    ).toEqual(offer);
  });

  it("decodes without atob or Buffer globals", () => {
    const encoded = encodeOffer(offer);
    vi.stubGlobal("atob", null);
    vi.stubGlobal("Buffer", null);
    try {
      expect(
        parseConnectionOfferUrl(`https://app.test/#offer=${encoded}`, validNow),
      ).toEqual(offer);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("connection offer parser rejection", () => {
  it("rejects unsupported top-level fields", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","nonce":"EjRWeBI0VngSNFZ4EjRWeA","expiresAt":"2026-04-18T00:10:00Z","authorization":{"required":true,"boundary":"${AUTHORIZATION_BOUNDARY}"},"relay":{"endpoint":"relay.example.test:443"},"secretKeyB64":"must-not-be-accepted"}`,
        ),
        validNow,
      ),
    ).toThrow(/unsupported field secretKeyB64/);
  });

  it("rejects missing authorization fields", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","nonce":"EjRWeBI0VngSNFZ4EjRWeA","expiresAt":"2026-04-18T00:10:00Z","authorization":{"required":true},"relay":{"endpoint":"relay.example.test:443"}}`,
        ),
        validNow,
      ),
    ).toThrow(/authorization/);
  });

  it("rejects expired offers", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(validOfferJson),
        new Date("2026-04-18T00:10:01.000Z"),
      ),
    ).toThrow(/expired/);
  });
});

describe("connection offer key material rejection", () => {
  it("rejects invalid nonce and public keys", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","nonce":"not-base64","expiresAt":"2026-04-18T00:10:00Z","authorization":{"required":true,"boundary":"${AUTHORIZATION_BOUNDARY}"},"relay":{"endpoint":"relay.example.test:443"}}`,
        ),
        validNow,
      ),
    ).toThrow(/nonce/);
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"not-base64","nonce":"EjRWeBI0VngSNFZ4EjRWeA","expiresAt":"2026-04-18T00:10:00Z","authorization":{"required":true,"boundary":"${AUTHORIZATION_BOUNDARY}"},"relay":{"endpoint":"relay.example.test:443"}}`,
        ),
        validNow,
      ),
    ).toThrow(/daemonPublicKeyB64/);
  });
});

describe("connection offer trust", () => {
  it("classifies first-seen hosts as new", () => {
    expect(evaluateConnectionOfferTrust(offer, [])).toEqual({
      kind: "new_host",
      offer,
    });
  });

  it("classifies matching trusted keys as known", () => {
    const host = trustedHost(daemonPublicKeyB64);
    expect(evaluateConnectionOfferTrust(offer, [host])).toEqual({
      kind: "known_host",
      offer,
      host,
    });
  });

  it("classifies same serverId with a different key as key_changed", () => {
    const host = trustedHost("old-public-key");
    expect(evaluateConnectionOfferTrust(offer, [host])).toEqual({
      kind: "key_changed",
      offer,
      host,
    });
  });

  it("classifies revoked hosts before accepting matching keys", () => {
    const host = Object.assign(trustedHost(daemonPublicKeyB64), {
      revokedAt: "2026-04-18T00:00:00.000Z",
    });
    expect(evaluateConnectionOfferTrust(offer, [host])).toEqual({
      kind: "revoked_host",
      offer,
      host,
    });
  });
});
