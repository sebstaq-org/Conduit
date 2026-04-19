import { Tuple, configureStore } from "@reduxjs/toolkit";
import { conduitApi } from "./api";
import { frontendLoggingMiddleware } from "./logging-middleware";
import { sessionPromptTurnsReducer } from "./session-prompt-turns";
import { sessionSelectionReducer } from "./session-selection";

const store = configureStore({
  reducer: {
    [conduitApi.reducerPath]: conduitApi.reducer,
    sessionPromptTurns: sessionPromptTurnsReducer,
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

export { store };
export type { AppDispatch, RootState };
