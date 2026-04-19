import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ConnectionHostProfile } from "@conduit/app-client";

const HOST_REGISTRY_STORAGE_KEY = "conduit.hostRegistry.v1";

interface HostRegistryState {
  activeHostId: string | null;
  hosts: ConnectionHostProfile[];
  pairingError: string | null;
}

interface PersistedHostRegistryState {
  activeHostId: string | null;
  hosts: ConnectionHostProfile[];
}

function emptyHostRegistryState(): HostRegistryState {
  return { activeHostId: null, hosts: [], pairingError: null };
}

function storage(): Storage | null {
  if (globalThis.localStorage === undefined) {
    return null;
  }
  return globalThis.localStorage;
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

function readPersistedHostRegistryState(value: unknown): HostRegistryState {
  if (!isRecord(value)) {
    return emptyHostRegistryState();
  }
  const hosts = readPersistedHosts(value.hosts);
  const activeHostId = readActiveHostId(value.activeHostId, hosts);
  return { activeHostId, hosts, pairingError: null };
}

function readInitialHostRegistryState(): HostRegistryState {
  const currentStorage = storage();
  if (currentStorage === null) {
    return emptyHostRegistryState();
  }
  const raw = currentStorage.getItem(HOST_REGISTRY_STORAGE_KEY);
  if (raw === null) {
    return emptyHostRegistryState();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return readPersistedHostRegistryState(parsed);
  } catch {
    return emptyHostRegistryState();
  }
}

function persistHostRegistryState(state: HostRegistryState): void {
  const currentStorage = storage();
  if (currentStorage === null) {
    return;
  }
  const persisted: PersistedHostRegistryState = {
    activeHostId: state.activeHostId,
    hosts: state.hosts,
  };
  currentStorage.setItem(HOST_REGISTRY_STORAGE_KEY, JSON.stringify(persisted));
}

const hostRegistrySlice = createSlice({
  initialState: readInitialHostRegistryState(),
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
  },
});

function selectHostProfiles(state: { hostRegistry: HostRegistryState }): ConnectionHostProfile[] {
  return state.hostRegistry.hosts;
}

function selectActiveHostProfile(
  state: { hostRegistry: HostRegistryState },
): ConnectionHostProfile | null {
  return (
    state.hostRegistry.hosts.find(
      (host) => host.serverId === state.hostRegistry.activeHostId,
    ) ?? null
  );
}

function selectPairingError(state: { hostRegistry: HostRegistryState }): string | null {
  return state.hostRegistry.pairingError;
}

const { hostAccepted, hostForgotten, hostPairingFailed } =
  hostRegistrySlice.actions;
const hostRegistryReducer = hostRegistrySlice.reducer;

export {
  hostAccepted,
  hostForgotten,
  hostPairingFailed,
  hostRegistryReducer,
  persistHostRegistryState,
  selectActiveHostProfile,
  selectHostProfiles,
  selectPairingError,
};
export type { HostRegistryState };
