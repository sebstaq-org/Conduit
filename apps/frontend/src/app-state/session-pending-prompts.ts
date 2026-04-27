import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  ContentBlock,
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";

interface PendingPromptMessage {
  baseRevision: number;
  id: string;
  openSessionId: string;
  submittedAt: number;
  text: string;
}

interface PendingPromptSubmittedPayload {
  baseRevision: number;
  openSessionId: string;
  text: string;
}

interface SessionPendingPromptsState {
  sequence: number;
  byOpenSessionId: Record<string, PendingPromptMessage[]>;
}

const initialState: SessionPendingPromptsState = {
  sequence: 0,
  byOpenSessionId: {},
};

function textFromContentBlocks(content: ContentBlock[]): string {
  return content
    .flatMap((block) => {
      if (
        typeof block !== "object" ||
        block === null ||
        !("type" in block) ||
        block.type !== "text" ||
        !("text" in block) ||
        typeof block.text !== "string"
      ) {
        return [];
      }
      return [block.text];
    })
    .join("")
    .trim();
}

function isBackendUserPromptItem(item: TranscriptItem, text: string): boolean {
  return (
    item.kind === "message" &&
    item.role === "user" &&
    item.turnId !== undefined &&
    textFromContentBlocks(item.content) === text
  );
}

function pendingPromptAcknowledged(
  history: SessionHistoryWindow,
  pending: PendingPromptMessage,
): boolean {
  if (history.revision <= pending.baseRevision) {
    return false;
  }
  return history.items.some((item) =>
    isBackendUserPromptItem(item, pending.text),
  );
}

function pendingPromptItem(pending: PendingPromptMessage): TranscriptItem {
  return {
    content: [{ text: pending.text, type: "text" }],
    id: pending.id,
    kind: "message",
    role: "user",
    status: "complete",
  };
}

function withPendingPromptMessages(
  history: SessionHistoryWindow,
  pendingPrompts: PendingPromptMessage[],
): SessionHistoryWindow {
  const visiblePendingItems = pendingPrompts
    .filter((pending) => !pendingPromptAcknowledged(history, pending))
    .map((pending) => pendingPromptItem(pending));
  if (visiblePendingItems.length === 0) {
    return history;
  }
  return {
    items: [...history.items, ...visiblePendingItems],
    nextCursor: history.nextCursor,
    openSessionId: history.openSessionId,
    revision: history.revision,
  };
}

const sessionPendingPromptsSlice = createSlice({
  name: "sessionPendingPrompts",
  initialState,
  reducers: {
    pendingPromptSubmitted: (
      state,
      action: PayloadAction<PendingPromptSubmittedPayload>,
    ): void => {
      state.sequence += 1;
      const pending: PendingPromptMessage = {
        baseRevision: action.payload.baseRevision,
        id: `pending-prompt:${action.payload.openSessionId}:${state.sequence}`,
        openSessionId: action.payload.openSessionId,
        submittedAt: Date.now(),
        text: action.payload.text,
      };
      state.byOpenSessionId[action.payload.openSessionId] = [
        ...(state.byOpenSessionId[action.payload.openSessionId] ?? []),
        pending,
      ];
    },
  },
});

const { pendingPromptSubmitted } = sessionPendingPromptsSlice.actions;
const sessionPendingPromptsReducer = sessionPendingPromptsSlice.reducer;

export {
  pendingPromptSubmitted,
  sessionPendingPromptsReducer,
  withPendingPromptMessages,
};
export type { PendingPromptMessage, SessionPendingPromptsState };
