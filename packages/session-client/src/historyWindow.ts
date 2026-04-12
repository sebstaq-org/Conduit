import type {
  ConsumerResponse,
  SessionHistoryWindow,
} from "@conduit/session-contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionHistoryWindow(value: unknown): value is SessionHistoryWindow {
  return (
    isRecord(value) &&
    typeof value.openSessionId === "string" &&
    typeof value.revision === "number" &&
    Array.isArray(value.items) &&
    (typeof value.nextCursor === "string" || value.nextCursor === null)
  );
}

function readSessionHistoryResponse(
  response: ConsumerResponse,
): ConsumerResponse<SessionHistoryWindow | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  if (!isSessionHistoryWindow(response.result)) {
    throw new Error("session history response shape is invalid");
  }
  return {
    id: response.id,
    ok: response.ok,
    result: response.result,
    error: response.error,
  };
}

export { readSessionHistoryResponse };
