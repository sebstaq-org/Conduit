import type { SessionClientPort } from "@conduit/session-client";

function unconfiguredError(): Error {
  return new Error("Pair a desktop before using Conduit sessions.");
}

async function rejectUnconfigured<Result>(): Promise<Result> {
  await Promise.resolve();
  throw unconfiguredError();
}

function closeUnconfigured(): void {
  void Promise.resolve();
}

function createUnconfiguredSessionClient(): SessionClientPort {
  return {
    addProject: rejectUnconfigured,
    close: closeUnconfigured,
    getProjectSuggestions: rejectUnconfigured,
    getProvidersConfigSnapshot: rejectUnconfigured,
    getSessionGroups: rejectUnconfigured,
    getSettings: rejectUnconfigured,
    listProjects: rejectUnconfigured,
    newSession: rejectUnconfigured,
    openSession: rejectUnconfigured,
    policy: "official-acp-only" as const,
    promptSession: rejectUnconfigured,
    readSessionHistory: rejectUnconfigured,
    removeProject: rejectUnconfigured,
    respondInteraction: rejectUnconfigured,
    setSessionConfigOption: rejectUnconfigured,
    subscribeSessionIndexChanges: rejectUnconfigured,
    subscribeTimelineChanges: rejectUnconfigured,
    updatePresence: rejectUnconfigured,
    updateProject: rejectUnconfigured,
    updateSettings: rejectUnconfigured,
  };
}

export { createUnconfiguredSessionClient };
