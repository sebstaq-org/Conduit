import type { SessionHistoryWindow } from "@conduit/session-client";

interface OlderHistoryState {
  cursor: string | null;
  openSessionId: string;
  pages: SessionHistoryWindow[];
  revision: number;
}

interface OlderHistoryPage {
  cursor: string;
  history: SessionHistoryWindow;
}

interface HistoryViewState {
  activeOlderHistory: OlderHistoryState | null;
  activeOlderPage: OlderHistoryPage | undefined;
  history: SessionHistoryWindow | undefined;
}

interface NextOlderHistoryInput {
  data: SessionHistoryWindow | undefined;
  olderHistory: OlderHistoryState | null;
  olderPage: OlderHistoryPage | undefined;
  openSessionId: string | null;
}

function activeOlderHistoryFor(
  olderHistory: OlderHistoryState | null,
  data: SessionHistoryWindow | undefined,
): OlderHistoryState | null {
  if (
    olderHistory !== null &&
    data !== undefined &&
    olderHistory.openSessionId === data.openSessionId &&
    olderHistory.revision === data.revision
  ) {
    return olderHistory;
  }
  return null;
}

function currentOlderPageFor(
  olderHistory: OlderHistoryState | null,
  cursor: string | null,
  data: SessionHistoryWindow | undefined,
): OlderHistoryPage | undefined {
  if (
    olderHistory === null ||
    cursor === null ||
    data === undefined ||
    olderHistory.cursor !== cursor ||
    olderHistory.openSessionId !== data.openSessionId ||
    olderHistory.revision !== data.revision
  ) {
    return undefined;
  }
  return {
    cursor,
    history: data,
  };
}

function activeOlderPageFor(
  olderHistory: OlderHistoryState | null,
  olderPage: OlderHistoryPage | undefined,
): OlderHistoryPage | undefined {
  if (
    olderHistory !== null &&
    olderPage !== undefined &&
    olderHistory.cursor === olderPage.cursor &&
    olderHistory.openSessionId === olderPage.history.openSessionId &&
    olderHistory.revision === olderPage.history.revision
  ) {
    return olderPage;
  }
  return undefined;
}

function nextCursorFor(
  data: SessionHistoryWindow,
  olderHistory: OlderHistoryState | null,
  olderPage: OlderHistoryPage | undefined,
): string | null {
  if (olderHistory === null) {
    return data.nextCursor;
  }
  if (olderPage !== undefined) {
    return olderPage.history.nextCursor;
  }
  return olderHistory.cursor;
}

function mergeHistory(
  data: SessionHistoryWindow | undefined,
  olderHistory: OlderHistoryState | null,
  olderPage: OlderHistoryPage | undefined,
): SessionHistoryWindow | undefined {
  if (data === undefined) {
    return undefined;
  }
  const pages = [...(olderHistory?.pages ?? [])];
  if (olderPage !== undefined) {
    pages.push(olderPage.history);
  }
  return {
    items: [...pages.flatMap((page) => page.items), ...data.items],
    nextCursor: nextCursorFor(data, olderHistory, olderPage),
    openSessionId: data.openSessionId,
    revision: data.revision,
  };
}

function historyViewState(
  data: SessionHistoryWindow | undefined,
  olderHistory: OlderHistoryState | null,
  olderPage: OlderHistoryPage | undefined,
): HistoryViewState {
  const activeOlderHistory = activeOlderHistoryFor(olderHistory, data);
  const activeOlderPage = activeOlderPageFor(activeOlderHistory, olderPage);
  return {
    activeOlderHistory,
    activeOlderPage,
    history: mergeHistory(data, activeOlderHistory, activeOlderPage),
  };
}

function nextOlderHistoryState({
  data,
  olderHistory,
  olderPage,
  openSessionId,
}: NextOlderHistoryInput): OlderHistoryState | null {
  if (
    openSessionId === null ||
    data === undefined ||
    data.openSessionId !== openSessionId
  ) {
    return olderHistory;
  }
  if (olderHistory === null) {
    if (data.nextCursor === null) {
      return olderHistory;
    }
    return {
      cursor: data.nextCursor,
      openSessionId: data.openSessionId,
      pages: [],
      revision: data.revision,
    };
  }
  if (olderPage === undefined) {
    return olderHistory;
  }
  return {
    cursor: olderPage.history.nextCursor,
    openSessionId: olderPage.history.openSessionId,
    pages: [...olderHistory.pages, olderPage.history],
    revision: olderPage.history.revision,
  };
}

export {
  activeOlderHistoryFor,
  currentOlderPageFor,
  historyViewState,
  nextOlderHistoryState,
};
export type { OlderHistoryPage, OlderHistoryState };
