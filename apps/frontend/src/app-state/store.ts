import { Tuple, configureStore } from "@reduxjs/toolkit";
import { conduitApi } from "./api";
import {
  hostRegistryReducer,
  persistHostRegistryState,
  selectActiveHostProfile,
} from "./host-registry";
import { frontendLoggingMiddleware } from "./logging-middleware";
import { sessionSelectionReducer } from "./session-selection";
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

let configuredHostId = "__initial__";

function syncSessionTransport(): void {
  const state = store.getState();
  const activeHost = selectActiveHostProfile(state);
  const nextHostId = activeHost?.serverId ?? "__direct__";
  if (configuredHostId !== nextHostId) {
    configureSessionClientForHost(activeHost);
    configuredHostId = nextHostId;
  }
  persistHostRegistryState(state.hostRegistry);
}

syncSessionTransport();
store.subscribe(syncSessionTransport);

export { store };
export type { AppDispatch, RootState };
