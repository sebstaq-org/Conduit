import type {
  GlobalSettingsUpdateRequest,
  ProjectAddRequest,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectUpdateRequest,
  SessionGroupsQuery,
  SessionHistoryRequest,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-model";
import {
  GlobalSettingsUpdateRequestSchema,
  ProjectAddRequestSchema,
  ProjectRemoveRequestSchema,
  ProjectSuggestionsQuerySchema,
  ProjectUpdateRequestSchema,
  SessionHistoryRequestSchema,
  SessionOpenRequestSchema,
  SessionPromptRequestSchema,
  SessionGroupsQuerySchema,
} from "@conduit/session-model";

function isSessionGroupsQuery(value: unknown): value is SessionGroupsQuery {
  return SessionGroupsQuerySchema.safeParse(value).success;
}

function isProjectAddRequest(value: unknown): value is ProjectAddRequest {
  return ProjectAddRequestSchema.safeParse(value).success;
}

function isProjectRemoveRequest(value: unknown): value is ProjectRemoveRequest {
  return ProjectRemoveRequestSchema.safeParse(value).success;
}

function isProjectUpdateRequest(value: unknown): value is ProjectUpdateRequest {
  return ProjectUpdateRequestSchema.safeParse(value).success;
}

function isProjectSuggestionsQuery(
  value: unknown,
): value is ProjectSuggestionsQuery {
  return ProjectSuggestionsQuerySchema.safeParse(value).success;
}

function isSessionOpenRequest(value: unknown): value is SessionOpenRequest {
  return SessionOpenRequestSchema.safeParse(value).success;
}

function isSessionHistoryRequest(
  value: unknown,
): value is SessionHistoryRequest {
  return SessionHistoryRequestSchema.safeParse(value).success;
}

function isSessionPromptRequest(value: unknown): value is SessionPromptRequest {
  return SessionPromptRequestSchema.safeParse(value).success;
}

function isGlobalSettingsUpdateRequest(
  value: unknown,
): value is GlobalSettingsUpdateRequest {
  return GlobalSettingsUpdateRequestSchema.safeParse(value).success;
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
  isGlobalSettingsUpdateRequest,
};
