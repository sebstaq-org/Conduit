import {
  ProjectListViewSchema,
  ProjectSuggestionsViewSchema,
} from "@conduit/session-model";
import type {
  ConsumerResponse,
  ProjectListView,
  ProjectSuggestionsView,
} from "@conduit/session-contracts";

function readProjectListResponse(
  response: ConsumerResponse,
  fallbackMessage: string,
): ProjectListView {
  if (!response.ok) {
    throw new Error(response.error?.message ?? fallbackMessage);
  }
  return ProjectListViewSchema.parse(response.result);
}

function readProjectSuggestionsResponse(
  response: ConsumerResponse,
): ProjectSuggestionsView {
  if (!response.ok) {
    throw new Error(response.error?.message ?? "project suggestions failed");
  }
  return ProjectSuggestionsViewSchema.parse(response.result);
}

export { readProjectListResponse, readProjectSuggestionsResponse };
