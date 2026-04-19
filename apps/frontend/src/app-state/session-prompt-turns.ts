import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ProviderId } from "@conduit/session-client";
import type { RootState } from "./store";

interface SessionPromptTurnIdentity {
  provider: ProviderId;
  sessionId: string;
}

interface SessionPromptTurnsState {
  activeCountByProvider: Partial<Record<ProviderId, Record<string, number>>>;
}

const initialState: SessionPromptTurnsState = {
  activeCountByProvider: {},
};

function providerSessions(
  state: SessionPromptTurnsState,
  provider: ProviderId,
): Record<string, number> {
  const existing = state.activeCountByProvider[provider];
  if (existing !== undefined) {
    return existing;
  }
  const sessions: Record<string, number> = {};
  state.activeCountByProvider[provider] = sessions;
  return sessions;
}

const sessionPromptTurnsSlice = createSlice({
  name: "sessionPromptTurns",
  initialState,
  reducers: {
    sessionPromptTurnFinished: (
      state,
      action: PayloadAction<SessionPromptTurnIdentity>,
    ): void => {
      const sessions = state.activeCountByProvider[action.payload.provider];
      if (sessions === undefined) {
        return;
      }
      const activeCount = sessions[action.payload.sessionId] ?? 0;
      if (activeCount <= 1) {
        state.activeCountByProvider[action.payload.provider] =
          Object.fromEntries(
            Object.entries(sessions).filter(
              ([sessionId]) => sessionId !== action.payload.sessionId,
            ),
          );
        return;
      }
      sessions[action.payload.sessionId] = activeCount - 1;
    },
    sessionPromptTurnStarted: (
      state,
      action: PayloadAction<SessionPromptTurnIdentity>,
    ): void => {
      const sessions = providerSessions(state, action.payload.provider);
      sessions[action.payload.sessionId] =
        (sessions[action.payload.sessionId] ?? 0) + 1;
    },
  },
});

type SessionPromptTurnsRootState = Pick<RootState, "sessionPromptTurns">;

function selectSessionPromptTurnStreaming(
  state: SessionPromptTurnsRootState,
  identity: SessionPromptTurnIdentity,
): boolean {
  return (
    (state.sessionPromptTurns.activeCountByProvider[identity.provider]?.[
      identity.sessionId
    ] ?? 0) > 0
  );
}

const { sessionPromptTurnFinished, sessionPromptTurnStarted } =
  sessionPromptTurnsSlice.actions;
const sessionPromptTurnsReducer = sessionPromptTurnsSlice.reducer;

export {
  selectSessionPromptTurnStreaming,
  sessionPromptTurnFinished,
  sessionPromptTurnStarted,
  sessionPromptTurnsReducer,
};
export type {
  SessionPromptTurnIdentity,
  SessionPromptTurnsRootState,
  SessionPromptTurnsState,
};
