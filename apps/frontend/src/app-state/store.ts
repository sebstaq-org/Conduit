import { Tuple, configureStore } from "@reduxjs/toolkit";
import { conduitApi } from "./api";
import {
  hostProfileTransportKey,
  hostRegistryHydrated,
  hostRegistryHydrationFailed,
  hostRegistryPersisted,
  hostRegistryPersistenceFailed,
  hostRegistryPersistenceKey,
  hostRegistryReducer,
  selectActiveHostProfile,
} from "./host-registry";
import {
  persistHostRegistryState,
  readPersistedHostRegistry,
  storageErrorMessage,
} from "./host-registry-storage";
import { frontendLoggingMiddleware } from "./logging-middleware";
import {
  activeSessionCleared,
  sessionSelectionReducer,
} from "./session-selection";
import { configureSessionClientForHost } from "./session-client";

const store = configureStore({
  reducer: {
    [conduitApi.reducerPath]: conduitApi.reducer,
    hostRegistry: hostRegistryReducer,
    sessionSelection: sessionSelectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    new Tuple(
      ...getDefaultMiddleware(),
      frontendLoggingMiddleware,
      conduitApi.middleware,
    ),
});

type AppDispatch = typeof store.dispatch;
type RootState = ReturnType<typeof store.getState>;

let configuredHostKey = "__initial__";
let persistedHostRegistryKey = "__initial__";

async function hydrateHostRegistry(): Promise<void> {
  try {
    store.dispatch(hostRegistryHydrated(await readPersistedHostRegistry()));
  } catch (error) {
    store.dispatch(hostRegistryHydrationFailed(storageErrorMessage(error)));
  }
}

function startHostRegistryHydration(): void {
  void hydrateHostRegistry();
}

function syncSessionTransport(state: RootState): void {
  if (!state.hostRegistry.hydrated) {
    return;
  }
  const activeHost = selectActiveHostProfile(state);
  const nextHostKey = hostProfileTransportKey(activeHost);
  if (configuredHostKey === nextHostKey) {
    return;
  }
  configureSessionClientForHost(activeHost);
  configuredHostKey = nextHostKey;
  store.dispatch(activeSessionCleared());
  store.dispatch(conduitApi.util.resetApiState());
}

async function persistHostRegistrySnapshot(
  state: RootState["hostRegistry"],
): Promise<void> {
  try {
    await persistHostRegistryState(state);
    store.dispatch(hostRegistryPersisted());
  } catch (error) {
    store.dispatch(hostRegistryPersistenceFailed(storageErrorMessage(error)));
  }
}

function startHostRegistryPersistence(state: RootState["hostRegistry"]): void {
  void persistHostRegistrySnapshot(state);
}

function syncHostRegistryPersistence(state: RootState): void {
  if (!state.hostRegistry.hydrated || !state.hostRegistry.storageAvailable) {
    return;
  }
  const nextPersistenceKey = hostRegistryPersistenceKey(state.hostRegistry);
  if (persistedHostRegistryKey === nextPersistenceKey) {
    return;
  }
  persistedHostRegistryKey = nextPersistenceKey;
  startHostRegistryPersistence(state.hostRegistry);
}

function syncStoreSideEffects(): void {
  const state = store.getState();
  syncSessionTransport(state);
  syncHostRegistryPersistence(state);
}

syncStoreSideEffects();
store.subscribe(syncStoreSideEffects);
startHostRegistryHydration();

export { store };
export type { AppDispatch, RootState };
