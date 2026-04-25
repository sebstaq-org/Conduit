import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ConnectionHostProfile } from "@conduit/app-client";

const HOST_REGISTRY_STORAGE_KEY = "conduit.hostRegistry.v1";

interface HostRegistryState {
  activeHostId: string | null;
  hydrated: boolean;
  hosts: ConnectionHostProfile[];
  pairingError: string | null;
  persistenceError: string | null;
  storageAvailable: boolean;
}

interface PersistedHostRegistryState {
  activeHostId: string | null;
  hosts: ConnectionHostProfile[];
}

function emptyHostRegistryState(): HostRegistryState {
  return {
    activeHostId: null,
    hosts: [],
    hydrated: false,
    pairingError: null,
    persistenceError: null,
    storageAvailable: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nullableString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function persistedDisplayName(value: Record<string, unknown>): string {
  if (
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0
  ) {
    return value.displayName;
  }
  return String(value.serverId);
}

function readPersistedHost(value: unknown): ConnectionHostProfile | null {
  if (!isRecord(value) || !isRecord(value.relay)) {
    return null;
  }
  if (
    typeof value.serverId !== "string" ||
    typeof value.trustedDaemonPublicKeyB64 !== "string" ||
    typeof value.offerNonce !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.relay.endpoint !== "string" ||
    typeof value.relay.serverId !== "string" ||
    typeof value.relay.clientCapability !== "string"
  ) {
    return null;
  }
  const lastSeenAt = nullableString(value.lastSeenAt);
  const revokedAt = nullableString(value.revokedAt);
  return {
    createdAt: value.createdAt,
    displayName: persistedDisplayName(value),
    lastSeenAt,
    offerNonce: value.offerNonce,
    relay: {
      clientCapability: value.relay.clientCapability,
      endpoint: value.relay.endpoint,
      serverId: value.relay.serverId,
    },
    revokedAt,
    serverId: value.serverId,
    trustedDaemonPublicKeyB64: value.trustedDaemonPublicKeyB64,
  };
}

function readPersistedHosts(value: unknown): ConnectionHostProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => readPersistedHost(item))
    .filter((host) => host !== null);
}

function readActiveHostId(
  value: unknown,
  hosts: readonly ConnectionHostProfile[],
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!hosts.some((host) => host.serverId === value)) {
    return null;
  }
  return value;
}

function emptyPersistedHostRegistryState(): PersistedHostRegistryState {
  return { activeHostId: null, hosts: [] };
}

function readPersistedHostRegistryState(
  value: unknown,
): PersistedHostRegistryState {
  if (!isRecord(value)) {
    return emptyPersistedHostRegistryState();
  }
  const hosts = readPersistedHosts(value.hosts);
  const activeHostId = readActiveHostId(value.activeHostId, hosts);
  return { activeHostId, hosts };
}

function hostRegistryPersistedState(
  state: HostRegistryState,
): PersistedHostRegistryState {
  return { activeHostId: state.activeHostId, hosts: state.hosts };
}

function hostRegistryPersistenceKey(state: HostRegistryState): string {
  return JSON.stringify(hostRegistryPersistedState(state));
}

function hostProfileTransportKey(host: ConnectionHostProfile | null): string {
  if (host === null) {
    return "__direct__";
  }
  return JSON.stringify({
    clientCapability: host.relay.clientCapability,
    daemonPublicKeyB64: host.trustedDaemonPublicKeyB64,
    endpoint: host.relay.endpoint,
    offerNonce: host.offerNonce,
    relayServerId: host.relay.serverId,
    serverId: host.serverId,
  });
}

const hostRegistrySlice = createSlice({
  initialState: emptyHostRegistryState(),
  name: "hostRegistry",
  reducers: {
    hostAccepted(state, action: PayloadAction<ConnectionHostProfile>) {
      const host = action.payload;
      const existingIndex = state.hosts.findIndex(
        (candidate) => candidate.serverId === host.serverId,
      );
      if (existingIndex === -1) {
        state.hosts.push(host);
      } else {
        state.hosts[existingIndex] = host;
      }
      state.activeHostId = host.serverId;
      state.pairingError = null;
    },
    hostForgotten(state, action: PayloadAction<string>) {
      state.hosts = state.hosts.filter(
        (host) => host.serverId !== action.payload,
      );
      if (state.activeHostId === action.payload) {
        state.activeHostId = null;
      }
    },
    hostPairingFailed(state, action: PayloadAction<string>) {
      state.pairingError = action.payload;
    },
    hostRegistryHydrated(
      state,
      action: PayloadAction<PersistedHostRegistryState>,
    ) {
      if (state.activeHostId !== null || state.hosts.length > 0) {
        state.hydrated = true;
        state.persistenceError = null;
        state.storageAvailable = true;
        return;
      }
      state.activeHostId = action.payload.activeHostId;
      state.hosts = action.payload.hosts;
      state.hydrated = true;
      state.persistenceError = null;
      state.storageAvailable = true;
    },
    hostRegistryHydrationFailed(state, action: PayloadAction<string>) {
      state.hydrated = true;
      state.persistenceError = action.payload;
      state.storageAvailable = false;
    },
    hostRegistryPersisted(state) {
      state.persistenceError = null;
      state.storageAvailable = true;
    },
    hostRegistryPersistenceFailed(state, action: PayloadAction<string>) {
      state.persistenceError = action.payload;
    },
  },
});

function selectHostProfiles(state: {
  hostRegistry: HostRegistryState;
}): ConnectionHostProfile[] {
  return state.hostRegistry.hosts;
}

function selectActiveHostProfile(state: {
  hostRegistry: HostRegistryState;
}): ConnectionHostProfile | null {
  return (
    state.hostRegistry.hosts.find(
      (host) => host.serverId === state.hostRegistry.activeHostId,
    ) ?? null
  );
}

function selectPairingError(state: {
  hostRegistry: HostRegistryState;
}): string | null {
  return state.hostRegistry.pairingError ?? state.hostRegistry.persistenceError;
}

const {
  hostAccepted,
  hostForgotten,
  hostPairingFailed,
  hostRegistryHydrated,
  hostRegistryHydrationFailed,
  hostRegistryPersisted,
  hostRegistryPersistenceFailed,
} = hostRegistrySlice.actions;
const hostRegistryReducer = hostRegistrySlice.reducer;

export {
  HOST_REGISTRY_STORAGE_KEY,
  hostAccepted,
  hostForgotten,
  hostProfileTransportKey,
  hostPairingFailed,
  hostRegistryHydrated,
  hostRegistryHydrationFailed,
  hostRegistryPersisted,
  hostRegistryPersistenceFailed,
  hostRegistryPersistedState,
  hostRegistryPersistenceKey,
  hostRegistryReducer,
  readPersistedHostRegistryState,
  selectActiveHostProfile,
  selectHostProfiles,
  selectPairingError,
};
export type { HostRegistryState, PersistedHostRegistryState };
