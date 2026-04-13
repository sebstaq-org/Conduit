import {
  addProjectQuery,
  getProjectSuggestionsQuery,
  listProjectsQuery,
  removeProjectQuery,
  updateProjectQuery,
} from "./session-api-queries";

const projectMutationInvalidations = [
  { id: "LIST", type: "Projects" },
  { id: "SUGGESTIONS", type: "Projects" },
  { id: "LIST", type: "SessionGroups" },
] as const;

const projectListEndpoint = {
  providesTags: [{ id: "LIST", type: "Projects" }],
  queryFn: listProjectsQuery,
} as const;

const projectAddEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: addProjectQuery,
} as const;

const projectRemoveEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: removeProjectQuery,
} as const;

const projectUpdateEndpoint = {
  invalidatesTags: projectMutationInvalidations,
  queryFn: updateProjectQuery,
} as const;

const projectSuggestionsEndpoint = {
  providesTags: [{ id: "SUGGESTIONS", type: "Projects" }],
  queryFn: getProjectSuggestionsQuery,
} as const;

export {
  projectAddEndpoint,
  projectListEndpoint,
  projectRemoveEndpoint,
  projectSuggestionsEndpoint,
  projectUpdateEndpoint,
};
