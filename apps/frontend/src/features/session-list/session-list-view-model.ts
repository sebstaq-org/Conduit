type SessionListProvider = "claude" | "codex" | "copilot";

interface SessionListSession {
  provider: SessionListProvider;
  sessionId: string;
  title: string | null;
  updatedAt: string | null;
}

interface SessionListGroup {
  cwd: string;
  groupId: string;
  label: string;
  sessions: SessionListSession[];
}

interface SessionListViewModel {
  groups: SessionListGroup[];
}

const sessionListViewModel: SessionListViewModel = {
  groups: [
    {
      cwd: "/workspace/base",
      groupId: "cwd:/workspace/base",
      label: "base",
      sessions: [],
    },
    {
      cwd: "/workspace/thread-lens-a",
      groupId: "cwd:/workspace/thread-lens-a",
      label: "thread-lens",
      sessions: [
        {
          provider: "codex",
          sessionId: "proof-collection",
          title: "Du ska genomföra den första faktiska bevisinsamling...",
          updatedAt: "2026-04-08T12:00:00.000Z",
        },
        {
          provider: "claude",
          sessionId: "new-document",
          title: "Du ska ta fram ett nytt dokument i /srv/devops/obsid...",
          updatedAt: "2026-04-08T12:00:00.000Z",
        },
        {
          provider: "codex",
          sessionId: "write-note",
          title: "Du ska skriva /srv/devops/obsidian-notes/Personal/...",
          updatedAt: "2026-04-08T12:00:00.000Z",
        },
        {
          provider: "copilot",
          sessionId: "strengthen-document",
          title: "Du ska stärka dokumentet /srv/devops/obsidian-not...",
          updatedAt: "2026-04-08T12:00:00.000Z",
        },
      ],
    },
    {
      cwd: "/workspace/validAIte",
      groupId: "cwd:/workspace/validAIte",
      label: "validAIte",
      sessions: [],
    },
    {
      cwd: "/workspace/thread-lens-b",
      groupId: "cwd:/workspace/thread-lens-b",
      label: "thread-lens",
      sessions: [],
    },
    {
      cwd: "/workspace/thread-lens-c",
      groupId: "cwd:/workspace/thread-lens-c",
      label: "thread-lens",
      sessions: [],
    },
    {
      cwd: "/workspace/thread-lens-d",
      groupId: "cwd:/workspace/thread-lens-d",
      label: "thread-lens",
      sessions: [],
    },
    {
      cwd: "/workspace/thread-lens-e",
      groupId: "cwd:/workspace/thread-lens-e",
      label: "thread-lens",
      sessions: [],
    },
  ],
};

export { sessionListViewModel };
export type {
  SessionListGroup,
  SessionListProvider,
  SessionListSession,
  SessionListViewModel,
};
