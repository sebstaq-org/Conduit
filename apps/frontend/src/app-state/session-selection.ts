import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ProviderId } from "@conduit/session-client";
import type { RootState } from "./store";

interface ActiveSession {
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
  openSessionId: string;
}

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
      action: PayloadAction<ActiveSession>,
    ): void => {
      state.activeSession = action.payload;
    },
  },
});

function selectActiveSession(state: RootState): ActiveSession | null {
  return state.sessionSelection.activeSession;
}

const { activeSessionOpened } = sessionSelectionSlice.actions;
const sessionSelectionReducer = sessionSelectionSlice.reducer;

export { activeSessionOpened, selectActiveSession, sessionSelectionReducer };
export type { ActiveSession };
