import {
  ConduitGlobalSettingsViewSchema,
  ConduitProjectListViewSchema,
  ConduitProjectSuggestionsViewSchema,
} from "@conduit/app-protocol";
import {
  GlobalSettingsViewSchema,
  ProjectListViewSchema,
  ProjectSuggestionsViewSchema,
} from "@conduit/session-model";
import type {
  ConsumerResponse,
  GlobalSettingsView,
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
  return ProjectListViewSchema.parse(
    ConduitProjectListViewSchema.parse(response.result),
  );
}

function readProjectSuggestionsResponse(
  response: ConsumerResponse,
): ProjectSuggestionsView {
  if (!response.ok) {
    throw new Error(response.error?.message ?? "project suggestions failed");
  }
  return ProjectSuggestionsViewSchema.parse(
    ConduitProjectSuggestionsViewSchema.parse(response.result),
  );
}

function readGlobalSettingsResponse(
  response: ConsumerResponse,
  fallbackMessage: string,
): GlobalSettingsView {
  if (!response.ok) {
    throw new Error(response.error?.message ?? fallbackMessage);
  }
  return GlobalSettingsViewSchema.parse(
    ConduitGlobalSettingsViewSchema.parse(response.result),
  );
}

export {
  readGlobalSettingsResponse,
  readProjectListResponse,
  readProjectSuggestionsResponse,
};
