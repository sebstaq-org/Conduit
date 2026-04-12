import type {
  ProjectAddRequest,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectUpdateRequest,
  SessionGroupsQuery,
  SessionHistoryRequest,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-model";

function isSessionGroupsQuery(value: unknown): value is SessionGroupsQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    !("cwdFilters" in value) &&
    !("sessionId" in value) &&
    !("openSessionId" in value)
  );
}

function isProjectAddRequest(value: unknown): value is ProjectAddRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "cwd" in value &&
    typeof value.cwd === "string"
  );
}

function isProjectRemoveRequest(value: unknown): value is ProjectRemoveRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "projectId" in value &&
    typeof value.projectId === "string"
  );
}

function isProjectUpdateRequest(value: unknown): value is ProjectUpdateRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "projectId" in value &&
    typeof value.projectId === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

function isProjectSuggestionsQuery(
  value: unknown,
): value is ProjectSuggestionsQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("query" in value) || typeof value.query === "string") &&
    (!("limit" in value) || typeof value.limit === "number")
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

function isSessionPromptRequest(value: unknown): value is SessionPromptRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "openSessionId" in value &&
    "prompt" in value &&
    Array.isArray(value.prompt)
  );
}

export {
  isProjectAddRequest,
  isProjectRemoveRequest,
  isProjectSuggestionsQuery,
  isProjectUpdateRequest,
  isSessionGroupsQuery,
  isSessionHistoryRequest,
  isSessionOpenRequest,
  isSessionPromptRequest,
};
