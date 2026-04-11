import type {
  SessionGroupsQuery,
  SessionHistoryRequest,
  SessionOpenRequest,
} from "@conduit/session-model";

function isSessionGroupsQuery(value: unknown): value is SessionGroupsQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    !("sessionId" in value) &&
    !("openSessionId" in value)
  );
}

function isSessionOpenRequest(value: unknown): value is SessionOpenRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "sessionId" in value &&
    "cwd" in value
  );
}

function isSessionHistoryRequest(
  value: unknown,
): value is SessionHistoryRequest {
  return (
    typeof value === "object" && value !== null && "openSessionId" in value
  );
}

export { isSessionGroupsQuery, isSessionHistoryRequest, isSessionOpenRequest };
