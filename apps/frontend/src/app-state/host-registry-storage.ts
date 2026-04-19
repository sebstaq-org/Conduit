import { getItemAsync, setItemAsync } from "expo-secure-store";
import {
  HOST_REGISTRY_STORAGE_KEY,
  hostRegistryPersistedState,
  readPersistedHostRegistryState,
} from "./host-registry";
import type {
  HostRegistryState,
  PersistedHostRegistryState,
} from "./host-registry";

function storageErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Host registry storage failed";
}

function webStorage(): Storage | null {
  try {
    if (globalThis.localStorage === undefined) {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isReactNativeRuntime(): boolean {
  return globalThis.navigator?.product === "ReactNative";
}

function parsePersistedPayload(raw: string | null): PersistedHostRegistryState {
  if (raw === null) {
    return { activeHostId: null, hosts: [] };
  }
  const parsed: unknown = JSON.parse(raw);
  return readPersistedHostRegistryState(parsed);
}

async function readPersistedHostRegistry(): Promise<PersistedHostRegistryState> {
  const currentStorage = webStorage();
  if (currentStorage !== null) {
    return parsePersistedPayload(
      currentStorage.getItem(HOST_REGISTRY_STORAGE_KEY),
    );
  }
  if (!isReactNativeRuntime()) {
    throw new Error("Host registry storage is unavailable");
  }
  const raw = await getItemAsync(HOST_REGISTRY_STORAGE_KEY);
  return parsePersistedPayload(raw);
}

async function persistHostRegistryState(
  state: HostRegistryState,
): Promise<void> {
  const payload = JSON.stringify(hostRegistryPersistedState(state));
  const currentStorage = webStorage();
  if (currentStorage !== null) {
    currentStorage.setItem(HOST_REGISTRY_STORAGE_KEY, payload);
    return;
  }
  if (!isReactNativeRuntime()) {
    throw new Error("Host registry storage is unavailable");
  }
  await setItemAsync(HOST_REGISTRY_STORAGE_KEY, payload);
}

export {
  parsePersistedPayload,
  persistHostRegistryState,
  readPersistedHostRegistry,
  storageErrorMessage,
};
