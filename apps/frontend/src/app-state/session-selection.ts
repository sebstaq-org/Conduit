import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ProviderId, SessionConfigOption } from "./models";
import type { RootState } from "./store";

interface OpenActiveSession {
  kind: "open";
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
  openSessionId: string;
  configOptions: SessionConfigOption[] | null;
  configSyncBlocked: boolean;
  configSyncError: string | null;
  modes: unknown;
  models: unknown;
}

interface DraftActiveSession {
  kind: "draft";
  cwd: string;
  provider: ProviderId | null;
  selectedConfigByProvider: Partial<Record<ProviderId, Record<string, string>>>;
}

type ActiveSession = DraftActiveSession | OpenActiveSession;

interface SessionSelectionState {
  activeSession: ActiveSession | null;
}

const initialState: SessionSelectionState = {
  activeSession: null,
};

const sessionSelectionSlice = createSlice({
  name: "sessionSelection",
  initialState,
  reducers: {
    activeSessionOpened: (
      state,
      action: PayloadAction<OpenActiveSession>,
    ): void => {
      state.activeSession = action.payload;
    },
    draftSessionProviderSelected: (
      state,
      action: PayloadAction<ProviderId>,
    ): void => {
      if (state.activeSession?.kind !== "draft") {
        return;
      }
      state.activeSession.provider = action.payload;
    },
    draftSessionStarted: (
      state,
      action: PayloadAction<Pick<DraftActiveSession, "cwd">>,
    ): void => {
      state.activeSession = {
        kind: "draft",
        cwd: action.payload.cwd,
        provider: null,
        selectedConfigByProvider: {},
      };
    },
    draftSessionConfigOptionSelected: (
      state,
      action: PayloadAction<{
        provider: ProviderId;
        configId: string;
        value: string;
      }>,
    ): void => {
      if (state.activeSession?.kind !== "draft") {
        return;
      }
      const existing =
        state.activeSession.selectedConfigByProvider[action.payload.provider] ??
        {};
      existing[action.payload.configId] = action.payload.value;
      state.activeSession.selectedConfigByProvider[action.payload.provider] =
        existing;
    },
    activeSessionConfigOptionsUpdated: (
      state,
      action: PayloadAction<{
        provider: ProviderId;
        sessionId: string;
        configOptions: SessionConfigOption[];
      }>,
    ): void => {
      if (state.activeSession?.kind !== "open") {
        return;
      }
      if (
        state.activeSession.provider !== action.payload.provider ||
        state.activeSession.sessionId !== action.payload.sessionId
      ) {
        return;
      }
      state.activeSession.configOptions = action.payload.configOptions;
      state.activeSession.configSyncBlocked = false;
      state.activeSession.configSyncError = null;
    },
    activeSessionConfigSyncBlocked: (
      state,
      action: PayloadAction<{
        provider: ProviderId;
        sessionId: string;
        error: string;
      }>,
    ): void => {
      if (state.activeSession?.kind !== "open") {
        return;
      }
      if (
        state.activeSession.provider !== action.payload.provider ||
        state.activeSession.sessionId !== action.payload.sessionId
      ) {
        return;
      }
      state.activeSession.configSyncBlocked = true;
      state.activeSession.configSyncError = action.payload.error;
    },
  },
});

function selectActiveSession(state: RootState): ActiveSession | null {
  return state.sessionSelection.activeSession;
}

const {
  activeSessionOpened,
  activeSessionConfigOptionsUpdated,
  activeSessionConfigSyncBlocked,
  draftSessionConfigOptionSelected,
  draftSessionProviderSelected,
  draftSessionStarted,
} = sessionSelectionSlice.actions;
const sessionSelectionReducer = sessionSelectionSlice.reducer;

export {
  activeSessionOpened,
  activeSessionConfigOptionsUpdated,
  activeSessionConfigSyncBlocked,
  draftSessionConfigOptionSelected,
  draftSessionProviderSelected,
  draftSessionStarted,
  selectActiveSession,
  sessionSelectionReducer,
};
export type { ActiveSession, DraftActiveSession, OpenActiveSession };
