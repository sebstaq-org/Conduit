import { expect, it } from "vitest";
import { SessionGroupsViewSchema } from "./src/index.js";

it("accepts the grouped sessions read model", () => {
  const payload = {
    groups: [
      {
        groupId: "cwd:/workspace/conduit",
        cwd: "/workspace/conduit",
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
    groups: [
      {
        cwd: "/workspace/conduit",
        sessions: [],
      },
    ],
  };

  expect(() => SessionGroupsViewSchema.parse(payload)).toThrow();
});

it("rejects unknown providers", () => {
  const payload = {
    groups: [
      {
        groupId: "cwd:/workspace/conduit",
        cwd: "/workspace/conduit",
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
