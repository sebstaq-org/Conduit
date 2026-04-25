/* eslint-disable vitest/prefer-strict-boolean-matchers, vitest/prefer-to-be-falsy, vitest/prefer-to-be-truthy */
import { describe, expect, it } from "vitest";
import {
  hostProfileTransportKey,
  hostRegistryHydrationFailed,
  hostRegistryReducer,
  readPersistedHostRegistryState,
  selectPairingError,
} from "./host-registry";
import type { ConnectionHostProfile } from "@conduit/app-client";

const baseHost: ConnectionHostProfile = {
  createdAt: "2026-04-19T00:00:00.000Z",
  displayName: "Conduit Desktop",
  lastSeenAt: "2026-04-19T00:00:00.000Z",
  offerNonce: "nonce-a",
  relay: {
    clientCapability: "cap-a",
    endpoint: "https://relay.example.test",
    serverId: "srv_relay",
  },
  revokedAt: null,
  serverId: "srv_desktop",
  trustedDaemonPublicKeyB64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
};

describe("registry state for paired hosts", () => {
  it("reads persisted hosts and drops invalid entries", () => {
    const state = readPersistedHostRegistryState({
      activeHostId: baseHost.serverId,
      hosts: [baseHost, { relay: {}, serverId: "broken" }],
    });

    expect(state.activeHostId).toBe(baseHost.serverId);
    expect(state.hosts).toEqual([baseHost]);
  });

  it("keys transport by relay route material, not only serverId", () => {
    const updatedHost: ConnectionHostProfile = {
      createdAt: baseHost.createdAt,
      displayName: baseHost.displayName,
      lastSeenAt: baseHost.lastSeenAt,
      offerNonce: baseHost.offerNonce,
      relay: {
        clientCapability: "cap-b",
        endpoint: baseHost.relay.endpoint,
        serverId: baseHost.relay.serverId,
      },
      revokedAt: baseHost.revokedAt,
      serverId: baseHost.serverId,
      trustedDaemonPublicKeyB64: baseHost.trustedDaemonPublicKeyB64,
    };

    expect(hostProfileTransportKey(updatedHost)).not.toBe(
      hostProfileTransportKey(baseHost),
    );
  });

  it("surfaces hydration failures as pairing errors", () => {
    const state = hostRegistryReducer(
      undefined,
      hostRegistryHydrationFailed("Secure storage unavailable"),
    );

    expect(state.hydrated).toBe(true);
    expect(state.storageAvailable).toBe(false);
    expect(selectPairingError({ hostRegistry: state })).toBe(
      "Secure storage unavailable",
    );
  });
});
