import { expect, it } from "vitest";
import {
  ProjectListViewSchema,
  ProjectSuggestionsViewSchema,
  SessionGroupsQuerySchema,
  SessionGroupsViewSchema,
} from "./src/index.js";

it("accepts the grouped sessions read model", () => {
  const payload = {
    revision: 1,
    refreshedAt: "2026-04-11T12:00:00.000Z",
    isRefreshing: false,
    groups: [
      {
        groupId: "cwd:/workspace/conduit",
        cwd: "/workspace/conduit",
        displayName: "conduit",
        sessions: [
          {
            provider: "codex",
            sessionId: "session-1",
            title: null,
            updatedAt: "2026-04-11T12:00:00.000Z",
          },
        ],
      },
    ],
  };

  expect(SessionGroupsViewSchema.parse(payload)).toEqual(payload);
});

it("rejects missing group identity", () => {
  const payload = {
    revision: 1,
    refreshedAt: null,
    isRefreshing: false,
    groups: [
      {
        cwd: "/workspace/conduit",
        displayName: "conduit",
        sessions: [],
      },
    ],
  };

  expect(() => SessionGroupsViewSchema.parse(payload)).toThrow();
});

it("rejects unknown providers", () => {
  const payload = {
    revision: 1,
    refreshedAt: null,
    isRefreshing: false,
    groups: [
      {
        groupId: "cwd:/workspace/conduit",
        cwd: "/workspace/conduit",
        displayName: "conduit",
        sessions: [
          {
            provider: "unknown",
            sessionId: "session-1",
            title: null,
            updatedAt: null,
          },
        ],
      },
    ],
  };

  expect(() => SessionGroupsViewSchema.parse(payload)).toThrow();
});

it("accepts the projects read model", () => {
  const payload = {
    projects: [
      {
        projectId: "cwd:/workspace/conduit",
        cwd: "/workspace/conduit",
        displayName: "conduit",
      },
    ],
  };

  expect(ProjectListViewSchema.parse(payload)).toEqual(payload);
});

it("accepts the project suggestions read model", () => {
  const payload = {
    suggestions: [
      {
        suggestionId: "cwd:/workspace/conduit",
        cwd: "/workspace/conduit",
      },
    ],
  };

  expect(ProjectSuggestionsViewSchema.parse(payload)).toEqual(payload);
});

it("rejects cwd filters in the session groups query", () => {
  const payload = {
    cwdFilters: ["/workspace/conduit"],
  };

  expect(() => SessionGroupsQuerySchema.parse(payload)).toThrow();
});
