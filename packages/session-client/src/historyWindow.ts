import { SessionHistoryWindowSchema } from "@conduit/session-model";
import type {
  ConsumerResponse,
  SessionHistoryWindow,
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

export { readSessionHistoryResponse };
