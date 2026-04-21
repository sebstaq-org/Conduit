import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface GeneratedSessionFixture {
  sessionId: string;
  title: string;
}

interface SessionHistoryFixtureRoot {
  anchorSentinel: string;
  cleanup: () => Promise<void>;
  earliestSentinel: string;
  followPrompt: string;
  followSentinel: string;
  followSessionTitle: string;
  historySessionTitle: string;
  latestSentinel: string;
  root: string;
  stopFollowPrompt: string;
  stopFollowSentinel: string;
  stopFollowSessionTitle: string;
}

interface PromptUpdateFixture {
  delayMs?: number;
  index: number;
  update: {
    content: {
      text: string;
      type: "text";
    };
    sessionUpdate: "agent_message_chunk";
  };
  variant: "agent_message_chunk";
}

const sourceDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(sourceDir, "..");
const staticFixtureRoot = join(appRoot, "fixtures", "provider");

const historySessionId = "e2e-codex-scroll-history-0001";
const followSessionId = "e2e-codex-follow-stream-0001";
const stopFollowSessionId = "e2e-codex-stop-stream-0001";
const historySessionTitle = "Conduit E2E long history session";
const followSessionTitle = "Conduit E2E follow stream session";
const stopFollowSessionTitle = "Conduit E2E stop stream session";
const historyItemCount = 140;
const followSentinel = "CONDUIT_E2E_FOLLOW_STREAM_SENTINEL";
const stopFollowSentinel = "CONDUIT_E2E_STOP_STREAM_SENTINEL";
const followPrompt =
  "Reply with the exact sentinel CONDUIT_E2E_FOLLOW_STREAM_SENTINEL in delayed chunks.";
const stopFollowPrompt =
  "Reply with the exact sentinel CONDUIT_E2E_STOP_STREAM_SENTINEL in delayed chunks.";
const transcriptResponse = {
  configOptions: [],
  currentModeId: null,
  modes: {
    availableModes: [],
    currentModeId: null,
  },
  models: null,
};

function historyItemSentinel(index: number): string {
  return `CONDUIT_E2E_HISTORY_ITEM_${String(index).padStart(3, "0")}`;
}

function historyTranscriptUpdates(): object[] {
  return Array.from({ length: historyItemCount }, (_value, index) => {
    const itemIndex = index + 1;
    const variant =
      itemIndex % 2 === 0 ? "agent_message_chunk" : "user_message_chunk";
    return {
      index,
      update: {
        content: {
          text: historyItemSentinel(itemIndex),
          type: "text",
        },
        sessionUpdate: variant,
      },
      variant,
    };
  });
}

function delayedPromptUpdates(
  sentinel: string,
  delayMs: number,
): PromptUpdateFixture[] {
  return sentinel.match(/.{1,4}/gu)!.map((chunk, index) => ({
    delayMs,
    index,
    update: {
      content: {
        text: chunk,
        type: "text",
      },
      sessionUpdate: "agent_message_chunk",
    },
    variant: "agent_message_chunk",
  }));
}

function sessionListFixture(sessions: GeneratedSessionFixture[]): object {
  return {
    sessions: sessions.map((session, index) => ({
      cwd: "/tmp/conduit-e2e-fixture-project",
      sessionId: session.sessionId,
      title: session.title,
      updatedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}Z`,
    })),
  };
}

async function ensureParentDirectory(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureParentDirectory(path);
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

async function copyInitializeFixture(
  root: string,
  provider: "claude" | "codex" | "copilot",
): Promise<void> {
  const source = join(
    staticFixtureRoot,
    provider,
    "initialize",
    "default",
    "provider.raw.json",
  );
  const target = join(root, provider, "initialize", "default", "provider.raw.json");
  await ensureParentDirectory(target);
  await copyFile(source, target);
}

async function writeEmptySessionList(
  root: string,
  provider: "claude" | "copilot",
): Promise<void> {
  await writeJson(join(root, provider, "session-list", "provider.raw.json"), {
    sessions: [],
  });
}

async function writeSessionLoadFixture(
  root: string,
  sessionId: string,
): Promise<void> {
  const captureDir = join(root, "codex", "session-load", sessionId);
  await writeJson(join(captureDir, "manifest.json"), {
    captureKind: "provider",
    contractBoundary: "provider-acp",
    curation:
      "Synthetic deterministic E2E fixture for session history scroll coverage.",
    cwd: "/tmp/conduit-e2e-fixture-project",
    manualCapture: false,
    operation: "session/load",
    provider: "codex",
    sessionId,
    timestamp: "2026-01-01T00:00:00Z",
  });
  await writeJson(join(captureDir, "provider.raw.json"), {
    loadedTranscript: {
      identity: {
        acpSessionId: sessionId,
        provider: "codex",
      },
      rawUpdateCount: historyItemCount,
      updates: historyTranscriptUpdates(),
    },
    response: transcriptResponse,
  });
}

async function writeSessionPromptFixture(args: {
  capture: string;
  prompt: string;
  responseSentinel: string;
  root: string;
  sessionId: string;
}): Promise<void> {
  const captureDir = join(
    args.root,
    "codex",
    "session-prompt",
    args.sessionId,
    args.capture,
  );
  await writeJson(join(captureDir, "manifest.json"), {
    captureKind: "provider",
    contractBoundary: "provider-acp",
    curation:
      "Synthetic deterministic E2E fixture for delayed session/prompt streaming coverage.",
    cwd: "/tmp/conduit-e2e-fixture-project",
    manualCapture: false,
    operation: "session/prompt",
    provider: "codex",
    sessionId: args.sessionId,
    timestamp: "2026-01-01T00:00:00Z",
  });
  await writeJson(join(captureDir, "provider.raw.json"), {
    configCapture: null,
    promptRequest: {
      prompt: [{ text: args.prompt, type: "text" }],
      sessionId: args.sessionId,
    },
    promptResponse: {
      stopReason: "end_turn",
    },
    promptUpdates: delayedPromptUpdates(args.responseSentinel, 90),
  });
}

async function createSessionHistoryFixtureRoot(): Promise<SessionHistoryFixtureRoot> {
  const root = await mkdtemp(join(tmpdir(), "conduit-e2e-session-history-"));
  await Promise.all([
    copyInitializeFixture(root, "claude"),
    copyInitializeFixture(root, "codex"),
    copyInitializeFixture(root, "copilot"),
  ]);
  await Promise.all([
    writeEmptySessionList(root, "claude"),
    writeEmptySessionList(root, "copilot"),
  ]);
  await writeJson(
    join(root, "codex", "session-list", "provider.raw.json"),
    sessionListFixture([
      { sessionId: historySessionId, title: historySessionTitle },
      { sessionId: followSessionId, title: followSessionTitle },
      { sessionId: stopFollowSessionId, title: stopFollowSessionTitle },
    ]),
  );
  await Promise.all([
    writeSessionLoadFixture(root, historySessionId),
    writeSessionLoadFixture(root, followSessionId),
    writeSessionLoadFixture(root, stopFollowSessionId),
    writeSessionPromptFixture({
      capture: "follow-stream",
      prompt: followPrompt,
      responseSentinel: followSentinel,
      root,
      sessionId: followSessionId,
    }),
    writeSessionPromptFixture({
      capture: "stop-follow-stream",
      prompt: stopFollowPrompt,
      responseSentinel: stopFollowSentinel,
      root,
      sessionId: stopFollowSessionId,
    }),
  ]);
  return {
    anchorSentinel: historyItemSentinel(50),
    cleanup: async () => {
      await rm(root, { force: true, recursive: true });
    },
    earliestSentinel: historyItemSentinel(1),
    followPrompt,
    followSentinel,
    followSessionTitle,
    historySessionTitle,
    latestSentinel: historyItemSentinel(historyItemCount),
    root,
    stopFollowPrompt,
    stopFollowSentinel,
    stopFollowSessionTitle,
  };
}

export { createSessionHistoryFixtureRoot };
export type { SessionHistoryFixtureRoot };
