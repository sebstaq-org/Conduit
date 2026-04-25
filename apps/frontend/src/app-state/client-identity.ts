import type { PresenceUpdateRequest } from "@conduit/session-client";

const CLIENT_IDENTITY_STORAGE_KEY = "conduit.clientIdentity.v1";

interface ClientIdentity {
  readonly clientId: string;
  readonly deviceKind: PresenceUpdateRequest["deviceKind"];
  readonly displayName: string;
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

function defaultDeviceKind(): PresenceUpdateRequest["deviceKind"] {
  if (isReactNativeRuntime()) {
    return "mobile";
  }
  return "web";
}

function defaultDisplayName(
  deviceKind: PresenceUpdateRequest["deviceKind"],
): string {
  if (deviceKind === "mobile") {
    return "Conduit Mobile";
  }
  return "Conduit Web";
}

function generatedClientId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi !== undefined && typeof cryptoApi.randomUUID === "function") {
    return `client_${cryptoApi.randomUUID()}`;
  }
  if (
    cryptoApi === undefined ||
    typeof cryptoApi.getRandomValues !== "function"
  ) {
    throw new Error("Client identity requires Web Crypto");
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return `client_${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readClientIdentity(value: unknown): ClientIdentity | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.clientId !== "string" ||
    value.clientId.trim().length === 0 ||
    typeof value.displayName !== "string" ||
    value.displayName.trim().length === 0 ||
    (value.deviceKind !== "mobile" && value.deviceKind !== "web")
  ) {
    return null;
  }
  return {
    clientId: value.clientId,
    deviceKind: value.deviceKind,
    displayName: value.displayName,
  };
}

function newClientIdentity(): ClientIdentity {
  const deviceKind = defaultDeviceKind();
  return {
    clientId: generatedClientId(),
    deviceKind,
    displayName: defaultDisplayName(deviceKind),
  };
}

function parseStoredIdentity(raw: string | null): ClientIdentity | null {
  if (raw === null) {
    return null;
  }
  return readClientIdentity(JSON.parse(raw));
}

async function readRawClientIdentity(): Promise<string | null> {
  const currentStorage = webStorage();
  if (currentStorage !== null) {
    return currentStorage.getItem(CLIENT_IDENTITY_STORAGE_KEY);
  }
  if (!isReactNativeRuntime()) {
    throw new Error("Client identity storage is unavailable");
  }
  const { getItemAsync } = await import("expo-secure-store");
  return getItemAsync(CLIENT_IDENTITY_STORAGE_KEY);
}

async function writeClientIdentity(identity: ClientIdentity): Promise<void> {
  const payload = JSON.stringify(identity);
  const currentStorage = webStorage();
  if (currentStorage !== null) {
    currentStorage.setItem(CLIENT_IDENTITY_STORAGE_KEY, payload);
    return;
  }
  if (!isReactNativeRuntime()) {
    throw new Error("Client identity storage is unavailable");
  }
  const { setItemAsync } = await import("expo-secure-store");
  await setItemAsync(CLIENT_IDENTITY_STORAGE_KEY, payload);
}

async function readOrCreateClientIdentity(): Promise<PresenceUpdateRequest> {
  const existing = parseStoredIdentity(await readRawClientIdentity());
  if (existing !== null) {
    return existing;
  }
  const created = newClientIdentity();
  await writeClientIdentity(created);
  return created;
}

export {
  CLIENT_IDENTITY_STORAGE_KEY,
  readClientIdentity,
  readOrCreateClientIdentity,
};
export type { ClientIdentity };
