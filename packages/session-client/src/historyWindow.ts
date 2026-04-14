import {
  SessionHistoryWindowSchema,
  SessionNewResultSchema,
} from "@conduit/session-model";
import type {
  ConsumerResponse,
  SessionHistoryWindow,
  SessionNewResult,
} from "@conduit/session-contracts";

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
  return {
    id: response.id,
    ok: response.ok,
    result: SessionHistoryWindowSchema.parse(response.result),
    error: response.error,
  };
}

function readSessionNewResponse(
  response: ConsumerResponse,
): ConsumerResponse<SessionNewResult | null> {
  if (!response.ok) {
    return {
      id: response.id,
      ok: response.ok,
      result: null,
      error: response.error,
    };
  }
  return {
    id: response.id,
    ok: response.ok,
    result: SessionNewResultSchema.parse(response.result),
    error: response.error,
  };
}

export { readSessionHistoryResponse, readSessionNewResponse };
