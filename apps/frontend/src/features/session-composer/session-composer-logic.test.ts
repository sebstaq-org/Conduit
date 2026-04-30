import { expect, it } from "vitest";
import type {
  ProvidersConfigSnapshotResult,
  SessionConfigOption,
} from "@conduit/session-client";
import { canSubmitPrompt } from "@/app-state/session-commands";
import type { ActiveSession } from "@/app-state/session-selection";
import {
  resolveDraftProviderReady,
  resolveDraftSnapshotEntry,
  resolveErrorMessage,
  resolveSessionComposerWorking,
  resolveVisibleConfigOptions,
} from "./session-composer-logic";

type ProviderSnapshotStatus =
  ProvidersConfigSnapshotResult["entries"][number]["status"];

function draftCodexSession(): ActiveSession {
  return {
    kind: "draft",
    cwd: "/workspace/conduit",
    provider: "codex",
    selectedConfigByProvider: {},
  };
}

function openCodexSession(): ActiveSession {
  return {
    kind: "open",
    configOptions: null,
    configSyncBlocked: false,
    configSyncError: null,
    cwd: "/workspace/conduit",
    modes: null,
    models: null,
    openSessionId: "open-session-1",
    provider: "codex",
    sessionId: "session-1",
    title: null,
  };
}

function selectOption(): SessionConfigOption {
  return {
    id: "reasoning_effort",
    name: "Reasoning",
    description: null,
    category: null,
    type: "select",
    currentValue: "medium",
    values: [
      { name: "Medium", value: "medium" },
      { name: "High", value: "high" },
    ],
  };
}

function fetchedAtForStatus(status: ProviderSnapshotStatus): string | null {
  if (status === "loading") {
    return null;
  }
  return "123";
}

function errorForStatus(status: ProviderSnapshotStatus): string | null {
  if (status === "error") {
    return "Codex probe failed";
  }
  return null;
}

function booleanLabel(value: boolean): "false" | "true" {
  if (value) {
    return "true";
  }
  return "false";
}

function providersSnapshot(
  codexStatus: ProviderSnapshotStatus,
  configOptions: SessionConfigOption[] | null,
): ProvidersConfigSnapshotResult {
  return {
    entries: [
      {
        provider: "codex",
        status: codexStatus,
        configOptions,
        modes: null,
        models: null,
        fetchedAt: fetchedAtForStatus(codexStatus),
        error: errorForStatus(codexStatus),
      },
    ],
  };
}

function errorMessage(args: {
  activeSession: ActiveSession;
  snapshot: ProvidersConfigSnapshotResult;
}): string | null {
  const snapshotEntry = resolveDraftSnapshotEntry(
    args.activeSession,
    args.snapshot,
  );
  return resolveErrorMessage({
    activeSession: args.activeSession,
    draftSnapshotEntry: snapshotEntry,
    newSessionError: false,
    promptError: false,
    providersConfigSnapshotError: false,
    setConfigError: false,
  });
}

it("surfaces provider config loading instead of silently disabling send", () => {
  const activeSession = draftCodexSession();
  const snapshotEntry = resolveDraftSnapshotEntry(
    activeSession,
    providersSnapshot("loading", null),
  );
  const providerReady = resolveDraftProviderReady(activeSession, snapshotEntry);

  expect(snapshotEntry?.status).toBe("loading");
  expect(resolveVisibleConfigOptions(activeSession, snapshotEntry)).toBeNull();
  expect(booleanLabel(providerReady)).toBe("false");
  expect(
    booleanLabel(
      canSubmitPrompt({
        activeSession,
        draftProviderReady: providerReady,
        isLoading: false,
        openSessionConfigSyncBlocked: false,
        text: "asasas",
      }),
    ),
  ).toBe("false");
  expect(
    errorMessage({
      activeSession,
      snapshot: providersSnapshot("loading", null),
    }),
  ).toBe("Loading Codex settings...");
});

it("enables the same draft composer once the provider snapshot becomes ready", () => {
  const activeSession = draftCodexSession();
  const snapshotEntry = resolveDraftSnapshotEntry(
    activeSession,
    providersSnapshot("ready", [selectOption()]),
  );
  const providerReady = resolveDraftProviderReady(activeSession, snapshotEntry);

  expect(resolveVisibleConfigOptions(activeSession, snapshotEntry)).toEqual([
    selectOption(),
  ]);
  expect(booleanLabel(providerReady)).toBe("true");
  expect(
    booleanLabel(
      canSubmitPrompt({
        activeSession,
        draftProviderReady: providerReady,
        isLoading: false,
        openSessionConfigSyncBlocked: false,
        text: "asasas",
      }),
    ),
  ).toBe("true");
  expect(
    errorMessage({
      activeSession,
      snapshot: providersSnapshot("ready", [selectOption()]),
    }),
  ).toBeNull();
});

it("keeps open-session composer working tied to the prompt mutation", () => {
  expect(
    booleanLabel(
      resolveSessionComposerWorking({
        activeSession: openCodexSession(),
        newSessionLoading: false,
        promptSessionLoading: false,
      }),
    ),
  ).toBe("false");
  expect(
    booleanLabel(
      resolveSessionComposerWorking({
        activeSession: openCodexSession(),
        newSessionLoading: false,
        promptSessionLoading: true,
      }),
    ),
  ).toBe("true");
});

it("keeps draft composer working while session creation or prompt submit runs", () => {
  expect(
    booleanLabel(
      resolveSessionComposerWorking({
        activeSession: draftCodexSession(),
        newSessionLoading: true,
        promptSessionLoading: false,
      }),
    ),
  ).toBe("true");
  expect(
    booleanLabel(
      resolveSessionComposerWorking({
        activeSession: draftCodexSession(),
        newSessionLoading: false,
        promptSessionLoading: true,
      }),
    ),
  ).toBe("true");
});

it("keeps idle draft composer idle", () => {
  expect(
    booleanLabel(
      resolveSessionComposerWorking({
        activeSession: draftCodexSession(),
        newSessionLoading: false,
        promptSessionLoading: false,
      }),
    ),
  ).toBe("false");
});

it("surfaces provider config errors for selected draft providers", () => {
  const activeSession = draftCodexSession();

  expect(
    errorMessage({
      activeSession,
      snapshot: providersSnapshot("error", null),
    }),
  ).toBe("Codex probe failed");
  expect(
    errorMessage({
      activeSession,
      snapshot: providersSnapshot("unavailable", null),
    }),
  ).toBe("Codex is unavailable.");
});
