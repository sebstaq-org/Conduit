import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ProviderId } from "@conduit/session-client";
import type { RootState } from "./store";

interface OpenActiveSession {
  kind: "open";
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
  openSessionId: string;
}

interface DraftActiveSession {
  kind: "draft";
  cwd: string;
  provider: ProviderId | null;
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
      };
    },
  },
});

function selectActiveSession(state: RootState): ActiveSession | null {
  return state.sessionSelection.activeSession;
}

const {
  activeSessionOpened,
  draftSessionProviderSelected,
  draftSessionStarted,
} = sessionSelectionSlice.actions;
const sessionSelectionReducer = sessionSelectionSlice.reducer;

export {
  activeSessionOpened,
  draftSessionProviderSelected,
  draftSessionStarted,
  selectActiveSession,
  sessionSelectionReducer,
};
export type { ActiveSession, DraftActiveSession, OpenActiveSession };
