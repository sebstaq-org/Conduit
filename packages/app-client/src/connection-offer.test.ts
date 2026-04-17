import { describe, expect, it } from "vitest";
import {
  evaluateConnectionOfferTrust,
  parseConnectionOfferUrl,
  readConnectionOffer,
} from "./index.js";
import type { ConnectionOfferV1, TrustedHostRecord } from "./index.js";

const daemonPublicKeyB64 = "g7EHNunwYfhVBZWTysT7l3F7knCHXeAFYk4/Oo4ff3Q=";
const offer = readConnectionOffer(
  JSON.parse(
    `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","relay":{"endpoint":"relay.example.test:443"}}`,
  ),
);

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
      parseConnectionOfferUrl(`https://app.test/#offer=${encodeOffer(offer)}`),
    ).toEqual(offer);
  });
});

describe("connection offer parser rejection", () => {
  it("rejects unsupported top-level fields", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","relay":{"endpoint":"relay.example.test:443"},"secretKeyB64":"must-not-be-accepted"}`,
        ),
      ),
    ).toThrow(/unsupported field secretKeyB64/);
  });

  it("rejects unsupported relay fields", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"${daemonPublicKeyB64}","relay":{"endpoint":"relay.example.test:443","localPath":"/tmp/conduit"}}`,
        ),
      ),
    ).toThrow(/unsupported field localPath/);
  });

  it("rejects missing and empty required fields", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          `{"v":1,"serverId":"","daemonPublicKeyB64":"${daemonPublicKeyB64}","relay":{"endpoint":"relay.example.test:443"}}`,
        ),
      ),
    ).toThrow(/serverId/);
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          '{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"","relay":{"endpoint":"relay.example.test:443"}}',
        ),
      ),
    ).toThrow(/daemonPublicKeyB64/);
  });

  it("rejects invalid public keys", () => {
    expect(() =>
      readConnectionOffer(
        JSON.parse(
          '{"v":1,"serverId":"srv_test","daemonPublicKeyB64":"not-base64","relay":{"endpoint":"relay.example.test:443"}}',
        ),
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
